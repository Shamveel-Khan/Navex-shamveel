import type {
  ActionResult,
  PageState,
  SessionCreated,
  TurnResponse,
} from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ClientOptions {
  baseUrl: string;
  apiKey: string;
}

export class NavexClient {
  constructor(private readonly options: ClientOptions) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ApiError(
        0,
        `Cannot reach the Navex backend at "${this.options.baseUrl}".`,
      );
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ApiError(response.status, `${response.status}: ${detail.slice(0, 200)}`);
    }
    return response.json() as Promise<T>;
  }

  createSession(): Promise<SessionCreated> {
    return this.post("/api/sessions", {});
  }

  chat(
    sessionId: string,
    message: string,
    page?: PageState,
  ): Promise<TurnResponse> {
    const payload: Record<string, unknown> = {
      session_id: sessionId,
      message,
    };
    if (page) payload.page = page;
    return this.post("/api/chat", payload);
  }

  observation(sessionId: string, result: ActionResult): Promise<TurnResponse> {
    return this.post("/api/agent/observation", {
      session_id: sessionId,
      result,
    });
  }
}
