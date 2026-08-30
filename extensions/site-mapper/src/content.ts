import { scanPage } from "./core/scanner";
import { collectInternalLinks } from "./core/routes";
import { destroyAgent, initAgent, isAgentActive } from "./content/agent";
import type { MapperMessage, MapperResponse, UnitResult } from "./protocol";

const RESCAN_DEBOUNCE_MS = 400;
const MUTATION_DEBOUNCE_MS = 600;

function currentUrl(): string {
  return window.location.href;
}

function originOf(): string {
  return window.location.origin;
}

function siteName(): string {
  const host = window.location.hostname.replace(/^www\./, "");
  return host.replace(/\./g, "-");
}

function sendPage(message: MapperMessage): void {
  chrome.runtime.sendMessage(message as unknown as Record<string, unknown>);
}

function runScan(origin: string): UnitResult {
  const result = scanPage(document, currentUrl(), { inject: true });
  recordActivity("scan", `${result.page.path}: ${result.page.elements.length} element(s), ${result.injected} data-waid injected`);
  sendPage({
    type: "PAGE_SCANNED",
    origin,
    site: siteName(),
    baseUrl: origin,
    page: result.page,
    links: collectInternalLinks(document, origin),
  });
  return {
    unit: "scan",
    detail: `${result.page.path}: ${result.page.elements.length} element(s), ${result.injected} data-waid injected`,
  };
}

let activity: UnitResult[] = [];
function recordActivity(unit: string, detail: string): void {
  activity.push({ unit, detail });
  if (activity.length > 30) activity = activity.slice(-30);
}

function scheduleRescan(origin: string): void {
  runScan(origin);
}

function patchHistory(origin: string, debounceMs: number): void {
  const dispatchChange = () => {
    setTimeout(() => scheduleRescan(origin), debounceMs);
  };
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function patchedPushState(...args: Parameters<typeof origPush>) {
    const result = origPush.apply(this, args as never);
    dispatchChange();
    return result;
  };
  history.replaceState = function patchedReplaceState(
    ...args: Parameters<typeof origReplace>
  ) {
    const result = origReplace.apply(this, args as never);
    dispatchChange();
    return result;
  };
  window.addEventListener("popstate", dispatchChange);
}

function installMutationObserver(origin: string): void {
  let timer: number | undefined;
  const observer = new MutationObserver(() => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => scheduleRescan(origin), MUTATION_DEBOUNCE_MS);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-waid", "aria-hidden", "disabled", "href"],
  });
}

function respond(message: MapperMessage): MapperResponse | null {
  switch (message.type) {
    case "SCAN_NOW": {
      const unit = runScan(message.origin);
      return { ok: true, detail: unit.detail };
    }
    case "VISIT_PATH": {
      const current = new URL(currentUrl());
      if (normalizePath(current.pathname) !== normalizePath(message.path)) {
        history.pushState({}, "", message.path);
        window.dispatchEvent(new PopStateEvent("popstate"));
        setTimeout(() => scheduleRescan(originOf()), RESCAN_DEBOUNCE_MS);
      }
      return { ok: true, detail: `navigated to ${message.path}` };
    }
    default:
      return null;
  }
}

function normalizePath(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

chrome.runtime.onMessage.addListener(
  (
    message: MapperMessage,
    _sender,
    sendResponse: (response: MapperResponse) => void,
  ) => {
    const response = respond(message);
    if (response) {
      sendResponse(response);
      return false;
    }
    return false;
  },
);

const origin = originOf();
patchHistory(origin, RESCAN_DEBOUNCE_MS);
installMutationObserver(origin);

async function syncAgentWithConfig(): Promise<void> {
  const response: MapperResponse | undefined = await chrome.runtime.sendMessage({
    type: "GET_CONFIG",
  } satisfies MapperMessage);
  const enabled = Boolean(response && response.ok && "config" in response && response.config.enabled);
  if (enabled && !isAgentActive()) initAgent();
  if (!enabled && isAgentActive()) destroyAgent();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes["navexChatEnabled"]) {
    const enabled = changes["navexChatEnabled"].newValue === true;
    if (enabled && !isAgentActive()) initAgent();
    if (!enabled && isAgentActive()) destroyAgent();
  }
});

void syncAgentWithConfig();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => runScan(origin), { once: true });
} else {
  runScan(origin);
  window.addEventListener("load", () => runScan(origin), { once: true });
}