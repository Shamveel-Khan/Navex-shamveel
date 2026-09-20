import { ApiError, NavexClient, type Transport } from "../client";
import { ChatWidget, type WidgetCallbacks } from "../chat-widget";
import { createExecutor, type ExecutorOptions } from "../executor";
import { runTurn, type RunTurnArgs, type RunTurnCallbacks } from "../driver";
import { observe } from "../observer";
import type { MapperMessage, MapperResponse } from "../protocol";
import { normalizePath } from "../core/routes";
import { scanPage } from "../core/scanner";
import type { SiteMap } from "../schema";

const relay: Transport = async (path, body) => {
  const response: MapperResponse | undefined = await chrome.runtime.sendMessage({
    type: "HTTP_RELAY",
    path,
    body,
  } satisfies MapperMessage);
  if (!response) {
    throw new ApiError(0, "NAVEX background worker is not responding.");
  }
  if (!response.ok) {
    throw new ApiError(0, response.error);
  }
  if (!("relay" in response)) {
    throw new ApiError(0, "unexpected relay response");
  }
  return {
    ok: response.relay.ok,
    status: response.relay.status,
    bodyText: response.relay.bodyText,
  };
};

function siteName(): string {
  return window.location.origin
    .replace(/^https?:\/\//, "")
    .replace(/[\.:]/g, "-");
}


let client: NavexClient | null = null;
let widget: ChatWidget | null = null;
let executor: ReturnType<typeof createExecutor> | null = null;
let sessionId: string | null = null;
let busy = false;
let initialized = false;

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return "Authentication failed — check the backend API key in the extension popup.";
    }
    if (err.status === 404 && err.message.includes("session")) {
      return "Your session expired. Please send your request again.";
    }
    if (err.status === 0) return err.message;
    return `The assistant hit an error (${err.message}).`;
  }
  return "Something went wrong while running the task.";
}

async function ensureSession(): Promise<string> {
  if (!client) throw new Error("agent not initialized");
  if (!sessionId) {
    const created = await client.createSession();
    sessionId = created.session_id;
  }
  return sessionId;
}

async function ensureMap(): Promise<void> {
  const page = scanPage(document, window.location.href, { inject: true }).page;
  await chrome.runtime.sendMessage({
    type: "ENSURE_MAP",
    origin: window.location.origin,
    site: siteName(),
    baseUrl: window.location.origin,
    page,
  } satisfies MapperMessage);
}

async function sendFullMapToBackend(): Promise<void> {
  const getMapResponse: MapperResponse | undefined = await chrome.runtime.sendMessage({
    type: "GET_MAP",
    origin: window.location.origin,
  } satisfies MapperMessage);
  if (!getMapResponse || !getMapResponse.ok || !("map" in getMapResponse) || !getMapResponse.map) {
    return;
  }
  const map: SiteMap = getMapResponse.map;
  const getConfigResponse: MapperResponse | undefined = await chrome.runtime.sendMessage({
    type: "GET_CONFIG",
  } satisfies MapperMessage);
  if (!getConfigResponse || !getConfigResponse.ok || !("config" in getConfigResponse)) {
    return;
  }
  const { backendUrl, apiKey } = getConfigResponse.config;
  if (!backendUrl || !apiKey) return;
  await chrome.runtime.sendMessage({
    type: "SEND_FULL_MAP",
    origin: window.location.origin,
    backendUrl,
    apiKey,
    site: siteName(),
  } satisfies MapperMessage);
}

async function handleSubmit(message: string): Promise<void> {
  if (!widget || !client || !executor) return;
  if (busy) return;
  busy = true;
  widget.setBusy(true);
  widget.setStatus("Scanning page…");
  const exec = executor;
  try {
    await ensureMap();
    await sendFullMapToBackend();
    const session = await ensureSession();
    await runTurn({
      client,
      sessionId: session,
      message,
      execute: (action) => exec.execute(action),
      observe: () => observe(),
      callbacks: {
        onStep: ({ step }) => widget?.setStatus(`Working… step ${step}`),
        onFinal: ({ reason, message: finalMessage }) => {
          widget?.addMessage(
            "agent",
            finalMessage || `Task ended (${reason}).`,
          );
          if (reason === "complete") sessionId = null;
        },
      },
    });
  } catch (err) {
    widget?.addMessage("agent", friendlyError(err));
  } finally {
    widget?.setBusy(false);
    widget?.setStatus(null);
    busy = false;
  }
}

export function initAgent(): void {
  if (initialized) return;
  initialized = true;

  const executorOptions: ExecutorOptions = {
    navigate: (path) => history.pushState({}, "", normalizePath(path)),
  };
  executor = createExecutor(executorOptions);
  client = new NavexClient({
    baseUrl: "",
    apiKey: "",
    transport: relay,
    siteName: siteName(),
  });
  widget = new ChatWidget(
    { onSubmit: (msg) => void handleSubmit(msg) },
    { shadow: true },
  );
}

export function destroyAgent(): void {
  widget?.destroy();
  widget = null;
  client = null;
  executor = null;
  sessionId = null;
  busy = false;
  initialized = false;
}

export function isAgentActive(): boolean {
  return initialized;
}