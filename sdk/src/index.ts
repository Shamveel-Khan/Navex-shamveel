import { ChatWidget } from "./chat-widget";
import { ApiError, NavexClient } from "./client";
import { createExecutor, type ExecutorOptions } from "./executor";
import { runTurn } from "./driver";
import { observe } from "./observer";
import type { ActionResult, AgentAction } from "./types";

export * from "./types";
export { observe, WAID_ATTR } from "./observer";
export { createExecutor, ActionError, type ExecutorOptions } from "./executor";
export {
  NavexClient,
  ApiError,
  type ClientOptions,
  type Transport,
  type TransportResponse,
} from "./client";
export { runTurn, type RunTurnArgs, type RunTurnCallbacks } from "./driver";
export { ChatWidget, type WidgetCallbacks, type WidgetOptions } from "./chat-widget";

export interface WebAgentOptions extends ExecutorOptions {
  apiKey: string;
  baseUrl?: string;
}

interface GlobalHarness {
  observe: typeof observe;
  execute: (action: AgentAction) => Promise<ActionResult>;
  getSessionId: () => string | null;
}

declare global {
  interface Window {
    __navex?: GlobalHarness;
  }
}

export class WebAgent {
  static init(options: WebAgentOptions): WebAgent {
    if (WebAgent.instance) return WebAgent.instance;
    WebAgent.instance = new WebAgent(options);
    return WebAgent.instance;
  }

  destroy(): void {
    this.widget.destroy();
    delete window.__navex;
    WebAgent.instance = undefined;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  private static instance?: WebAgent;

  private sessionId: string | null = null;
  private readonly client: NavexClient;
  private readonly executor: ReturnType<typeof createExecutor>;
  private readonly widget: ChatWidget;
  private busy = false;

  private constructor(options: WebAgentOptions) {
    const { apiKey, baseUrl = "", ...executorOptions } = options;
    this.client = new NavexClient({ baseUrl, apiKey });
    this.executor = createExecutor(executorOptions);

    window.__navex = {
      observe,
      execute: (action) => this.executor.execute(action),
      getSessionId: () => this.sessionId,
    };

    this.widget = new ChatWidget({ onSubmit: (message) => this.handleSend(message) });
  }

  private async ensureSession(): Promise<string> {
    if (!this.sessionId) {
      const created = await this.client.createSession();
      this.sessionId = created.session_id;
    }
    return this.sessionId;
  }

  private async handleSend(message: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.widget.setBusy(true);

    try {
      const sessionId = await this.ensureSession();
      const finalTurn = await runTurn({
        client: this.client,
        sessionId,
        message,
        execute: (action) => this.executor.execute(action),
        observe: () => observe(),
        callbacks: {
          onStep: ({ step }) =>
            this.widget.setStatus(`Working… step ${step}`),
          onFinal: ({ reason, message: finalMessage }) => {
            this.widget.addMessage(
              "agent",
              finalMessage || `Task ended (${reason}).`,
            );
            if (reason === "complete") this.sessionId = null;
          },
        },
      });
      void finalTurn;
    } catch (err) {
      this.widget.addMessage("agent", this.friendlyError(err));
    } finally {
      this.widget.setBusy(false);
      this.widget.setStatus(null);
      this.busy = false;
    }
  }

  private friendlyError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401)
        return "Authentication failed — check your Navex API key.";
      if (err.status === 404 && err.message.includes("session"))
        return "Your session expired. Please send your request again.";
      if (err.status === 0) return err.message;
      return `The assistant hit an error (${err.message}).`;
    }
    return "Something went wrong while running the task.";
  }
}
