import type { PageNode, SiteMap } from "./schema";
import { validateSiteMap } from "./schema";
import type { LinkTarget } from "./core/routes";
import type { MapperMessage, MapperResponse } from "./protocol";

const STORAGE_PREFIX = "navex-map:";

interface OriginState {
  map: SiteMap;
  linkIndex: Map<string, string>;
}

const origins = new Map<string, OriginState>();

function keyFor(origin: string): string {
  return `${STORAGE_PREFIX}${origin}`;
}

async function loadOrigin(origin: string): Promise<OriginState | null> {
  if (origins.has(origin)) return origins.get(origin) ?? null;
  const stored = await chrome.storage.session.get(keyFor(origin));
  const raw = stored[keyFor(origin)];
  if (!raw) return null;
  const map = JSON.parse(raw) as SiteMap;
  const state: OriginState = { map, linkIndex: new Map() };
  origins.set(origin, state);
  return state;
}

async function persist(state: OriginState, origin: string): Promise<void> {
  await chrome.storage.session.set({
    [keyFor(origin)]: JSON.stringify(state.map),
  });
}

function emptyMap(origin: string): SiteMap {
  return {
    site: origin.replace(/^https?:\/\//, "").replace(/[\.:]/g, "-"),
    base_url: origin,
    generated_at: new Date().toISOString(),
    pages: [],
  };
}

function mergePage(state: OriginState, page: PageNode): boolean {
  const existing = state.map.pages.find((p) => p.path === page.path);
  if (existing) {
    const ids = new Set(existing.elements.map((e) => e.id));
    const additions = page.elements.filter((e) => !ids.has(e.id));
    if (additions.length === 0 && existing.description === page.description) {
      return false;
    }
    existing.title = page.title ?? existing.title;
    existing.description = page.description ?? existing.description;
    existing.truncated = page.truncated ?? existing.truncated;
    existing.elements = [...existing.elements, ...additions];
    return additions.length > 0;
  }
  state.map.pages.push({
    ...page,
    elements: [...page.elements],
  });
  state.map.pages.sort((a, b) => a.path.localeCompare(b.path));
  return true;
}

chrome.runtime.onMessage.addListener((message: MapperMessage, _sender, sendResponse) => {
  void (async (): Promise<MapperResponse> => {
    // SCAN_NOW / VISIT_PATH are handled by the content script; if they ever
    // arrive here (e.g. from another extension context), forward them to the
    // active tab so the scan still happens.
    if (message.type === "SCAN_NOW" || message.type === "VISIT_PATH") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== undefined) {
        const forwarded = await chrome.tabs
          .sendMessage(tab.id, message)
          .catch(() => null);
        if (forwarded) return forwarded as MapperResponse;
      }
      return {
        ok: false,
        error: "no content script reachable in the active tab",
      };
    }

    switch (message.type) {
      case "ENSURE_MAP":
      case "PAGE_SCANNED": {
        const state = await loadOrigin(message.origin);
        const map = state?.map ?? emptyMap(message.origin);
        const links = message.links || [];
        const s: OriginState = {
          map,
          linkIndex: new Map(links.map((l) => [l.path, l.label])),
        };
        origins.set(message.origin, s);
        const changed = mergePage(s, message.page);
        s.map.generated_at = new Date().toISOString();
        await persist(s, message.origin);

        if (changed) {
          chrome.runtime.sendMessage({
            type: "MAP_UPDATED",
            map: s.map,
          } satisfies MapperMessage);
        }
        return {
          ok: true,
          state: {
            pages: s.map.pages.length,
            elements: s.map.pages.reduce((n, p) => n + p.elements.length, 0),
            unvisited: unvisitedFor(s),
          },
        };
      }
      case "GET_MAP": {
        const state = await loadOrigin(message.origin);
        return { ok: true, map: state?.map ?? null };
      }
      case "GET_STATE": {
        const state = await loadOrigin(message.origin);
        return {
          ok: true,
          state: {
            pages: state?.map.pages.length ?? 0,
            elements:
              state?.map.pages.reduce((n, p) => n + p.elements.length, 0) ?? 0,
            unvisited: state ? unvisitedFor(state) : [],
          },
        };
      }
      case "EXPORT_MAP": {
        const state = await loadOrigin(message.origin);
        if (!state) return { ok: true, json: "null" };
        return { ok: true, json: JSON.stringify(state.map, null, 2) };
      }
      case "SEND_TO_BACKEND": {
        const state = await loadOrigin(message.origin);
        if (!state) return { ok: false, error: "no map for this origin yet" };
        const errors = validateSiteMap(state.map);
        if (errors.length > 0) {
          return { ok: false, error: `map invalid: ${errors.slice(0, 3).join("; ")}` };
        }
        const url = `${message.backendUrl.replace(/\/+$/, "")}/api/site-maps`;
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${message.apiKey}`,
            },
            body: JSON.stringify({ map: state.map }),
          });
          if (!response.ok) {
            const body = await response.text().catch(() => "");
            return {
              ok: false,
              error: `backend rejected (${response.status}): ${body.slice(0, 200)}`,
            };
          }
          return { ok: true, detail: "map sent to NAVEX backend" };
        } catch (err) {
          return {
            ok: false,
            error: `cannot reach backend: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
      case "GET_CONFIG": {
        const { chatEnabled, backendUrl, apiKey } = await chrome.storage.local.get([
          "navexChatEnabled",
          "navexBackendUrl",
          "navexApiKey",
        ]);
        return {
          ok: true,
          config: {
            backendUrl: (backendUrl as string | undefined) ?? "",
            apiKey: (apiKey as string | undefined) ?? "",
            enabled: chatEnabled === true,
          },
        };
      }
      case "GET_CHAT_ENABLED": {
        const { chatEnabled } = await chrome.storage.local.get("navexChatEnabled");
        return { ok: true, enabled: chatEnabled === true };
      }
      case "SET_CHAT_ENABLED": {
        await chrome.storage.local.set({ navexChatEnabled: message.enabled });
        return { ok: true, enabled: message.enabled };
      }
      case "CLEAR_MAP": {
        origins.delete(message.origin);
        await chrome.storage.session.remove(keyFor(message.origin));
        return { ok: true, detail: "map cleared" };
      }
      case "SEND_FULL_MAP": {
        const state = await loadOrigin(message.origin);
        if (!state) {
          return { ok: false, error: "no map for this origin yet" };
        }
        const errors = validateSiteMap(state.map);
        if (errors.length > 0) {
          return {
            ok: false,
            error: `map invalid: ${errors.slice(0, 3).join("; ")}`,
          };
        }
        const url = `${message.backendUrl.replace(/\/+$/, "")}/api/site-maps`;
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${message.apiKey}`,
            },
            body: JSON.stringify({ map: state.map }),
          });
          if (!response.ok) {
            const body = await response.text().catch(() => "");
            return {
              ok: false,
              error: `backend rejected (${response.status}): ${body.slice(0, 200)}`,
            };
          }
          return {
            ok: true,
            sent: {
              site: state.map.site,
              pages: state.map.pages.length,
              elements: state.map.pages.reduce(
                (n, p) => n + p.elements.length,
                0,
              ),
            },
          };
        } catch (err) {
          return {
            ok: false,
            error: `cannot reach backend: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
      case "HTTP_RELAY": {
        const { navexBackendUrl: backendUrl, navexApiKey: apiKey } =
          await chrome.storage.local.get(["navexBackendUrl", "navexApiKey"]);
        if (!backendUrl || !apiKey) {
          return {
            ok: false,
            error:
              "Backend URL and API key are not configured. Set them in the extension popup.",
          };
        }
        try {
          const response = await fetch(`${backendUrl.replace(/\/+$/, "")}${message.path}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(message.body),
          });
          const bodyText = await response.text().catch(() => "");
          return {
            ok: true,
            relay: { ok: response.ok, status: response.status, bodyText },
          };
        } catch (err) {
          return {
            ok: false,
            error: `cannot reach backend: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
      default:
        return { ok: false, error: `unhandled message: ${message.type}` };
    }
  })().then(
    (response) => {
      sendResponse(response);
    },
    (err) => {
      sendResponse({ ok: false, error: String(err) });
    },
  );
  return true;
});

function unvisitedFor(state: OriginState): LinkTarget[] {
  const visited = new Set(state.map.pages.map((p) => p.path));
  return Array.from(state.linkIndex.entries())
    .filter(([path]) => !visited.has(path))
    .map(([path, label]) => ({ path, label }));
}

chrome.runtime.onMessage.addListener((message: MapperMessage) => {
  if (message.type === "MAP_UPDATED") {
    // Broadcast map updates to live popups.
    void message;
  }
});