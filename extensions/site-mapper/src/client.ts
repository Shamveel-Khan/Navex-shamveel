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

export interface TransportResponse {
  ok: boolean;
  status: number;
  bodyText: string;
}

/** Custom HTTP transport for the client (e.g. relaying requests through a
 *  browser-extension service worker). Defaults to fetch against `baseUrl`. */
export type Transport = (
  path: string,
  body: unknown,
) => Promise<TransportResponse>;

export interface ClientOptions {
  baseUrl: string;
  apiKey: string;
  transport?: Transport;
  siteName?: string;
}

export class NavexClient {
  constructor(private readonly options: ClientOptions) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    let response: TransportResponse;
    if (this.options.transport) {
      response = await this.options.transport(path, body);
    } else {
      let raw: Response;
      try {
        raw = await fetch(`${this.options.baseUrl}${path}`, {
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
      const bodyText = await raw.text().catch(() => "");
      response = { ok: raw.ok, status: raw.status, bodyText };
    }

    if (!response.ok) {
      throw new ApiError(
        response.status,
        `${response.status}: ${response.bodyText.slice(0, 200)}`,
      );
    }
    if (!response.bodyText) return undefined as T;
    try {
      return JSON.parse(response.bodyText) as T;
    } catch {
      throw new ApiError(
        response.status,
        `invalid JSON from backend: ${response.bodyText.slice(0, 200)}`,
      );
    }
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
    if (this.options.siteName) payload.site = this.options.siteName;
    return this.post("/api/chat", payload);
  }

  observation(sessionId: string, result: ActionResult): Promise<TurnResponse> {
    return this.post("/api/agent/observation", {
      session_id: sessionId,
      result,
    });
  }
}
