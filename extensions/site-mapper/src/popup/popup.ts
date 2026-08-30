import type { MapperMessage, MapperResponse } from "../protocol";
import type { PageNode, SiteMap } from "../schema";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

let activeOrigin = "";
let activeTabId = -1;

async function currentTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

function send(message: MapperMessage): Promise<MapperResponse> {
  return chrome.runtime.sendMessage(message) as Promise<MapperResponse>;
}

/** Sends directly to the content script in the active tab (SCAN_NOW, VISIT_PATH). */
function sendTab(message: MapperMessage): Promise<MapperResponse> {
  return chrome.tabs.sendMessage(activeTabId, message) as Promise<MapperResponse>;
}

function setMessage(text: string, kind: "ok" | "err" = "ok"): void {
  const el = $<HTMLDivElement>("message");
  el.textContent = text;
  el.className = `message ${kind}`;
}

function render(pages: PageNode[], unvisited: { path: string; label: string }[]): void {
  $<HTMLSpanElement>("stat-pages").textContent = String(pages.length);
  $<HTMLSpanElement>("stat-elements").textContent = String(
    pages.reduce((n, p) => n + p.elements.length, 0),
  );

  const pageList = $<HTMLUListElement>("page-list");
  pageList.innerHTML = "";
  if (pages.length === 0) {
    const li = document.createElement("li");
    li.className = "message ok";
    li.textContent = "No pages mapped yet.";
    pageList.appendChild(li);
  } else {
    for (const page of pages) {
      const li = document.createElement("li");
      li.className = "page-item";
      const path = document.createElement("span");
      path.className = "p";
      path.textContent = page.path;
      const count = document.createElement("span");
      count.className = "n";
      count.textContent = `${page.elements.length} el`;
      li.appendChild(path);
      li.appendChild(count);
      pageList.appendChild(li);
    }
  }

  const routeList = $<HTMLUListElement>("route-list");
  routeList.innerHTML = "";
  if (unvisited.length === 0) {
    const li = document.createElement("li");
    li.className = "message ok";
    li.textContent = "None — visit links to map them.";
    routeList.appendChild(li);
  } else {
    for (const route of unvisited) {
      const li = document.createElement("li");
      li.className = "route";
      const path = document.createElement("span");
      path.className = "path";
      path.textContent = route.path;
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = route.label;
      const visit = document.createElement("button");
      visit.textContent = "Visit";
      visit.addEventListener("click", async () => {
        try {
          const response = await sendTab({
            type: "VISIT_PATH",
            path: route.path,
          });
          if (response.ok && "detail" in response) setMessage(response.detail);
          else if (!response.ok) setMessage(response.error, "err");
        } catch {
          setMessage(
            "Cannot reach the content script on this tab — reload the page and retry.",
            "err",
          );
        }
        setTimeout(() => refresh(), 900);
      });
      li.appendChild(path);
      li.appendChild(label);
      li.appendChild(visit);
      routeList.appendChild(li);
    }
  }
}

async function refresh(): Promise<void> {
  if (!activeOrigin) return;
  const response = await send({ type: "GET_STATE", origin: activeOrigin });
  if (!response.ok) {
    setMessage(response.error, "err");
    return;
  }
  if ("state" in response && response.state) {
    let pages: PageNode[] = [];
    const map = await send({ type: "GET_MAP", origin: activeOrigin });
    if ("map" in map && map.ok && map.map) pages = map.map.pages;
    render(
      pages,
      response.state.unvisited.map((u) => ({ path: u.path, label: u.label })),
    );
  }
}

async function init(): Promise<void> {
  const tab = await currentTab();
  if (!tab?.url) {
    $<HTMLDivElement>("origin").textContent = "No page in this tab.";
    return;
  }
  let origin: string;
  try {
    origin = new URL(tab.url).origin;
  } catch {
    $<HTMLDivElement>("origin").textContent = "Unsupported page (no URL).";
    return;
  }
  if (tab.id !== undefined) activeTabId = tab.id;
  activeOrigin = origin;
  $<HTMLDivElement>("origin").textContent = origin;

  const stored = await chrome.storage.local.get([
    "navexBackendUrl",
    "navexApiKey",
    "navexChatEnabled",
  ]);
  $<HTMLInputElement>("backend-url").value =
    stored["navexBackendUrl"] ?? "http://localhost:8000";
  $<HTMLInputElement>("api-key").value = stored["navexApiKey"] ?? "";
  $<HTMLInputElement>("chat-enabled").checked = stored["navexChatEnabled"] === true;

  $<HTMLButtonElement>("btn-scan").addEventListener("click", async () => {
    if (activeTabId < 0) {
      setMessage("No tab to scan.", "err");
      return;
    }
    let response: MapperResponse;
    try {
      response = await sendTab({ type: "SCAN_NOW", origin: activeOrigin });
    } catch {
      setMessage(
        "Cannot reach the content script — reload the page tab (or load the site in a fresh tab) and retry.",
        "err",
      );
      return;
    }
    if (response.ok && "detail" in response) {
      setMessage(response.detail);
    } else if (!response.ok) {
      setMessage(response.error, "err");
    } else {
      setMessage("Scanned.");
    }
    setTimeout(() => refresh(), 500);
  });

  $<HTMLButtonElement>("btn-export").addEventListener("click", async () => {
    const response = await send({ type: "EXPORT_MAP", origin: activeOrigin });
    if (!response.ok) {
      setMessage(response.error, "err");
      return;
    }
    if (!("json" in response) || response.json === "null") {
      setMessage("No map yet.", "err");
      return;
    }
    await navigator.clipboard.writeText(response.json);
    setMessage("Map JSON copied to clipboard.");
  });

  $<HTMLButtonElement>("btn-download").addEventListener("click", async () => {
    const response = await send({ type: "EXPORT_MAP", origin: activeOrigin });
    if (!response.ok || !("json" in response) || response.json === "null") {
      setMessage("No map yet.", "err");
      return;
    }
    const blob = new Blob([response.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `navex-map-${activeOrigin.replace(/[^a-z0-9]+/gi, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Map downloaded.");
  });

  $<HTMLButtonElement>("btn-send").addEventListener("click", async () => {
    const backendUrl = $<HTMLInputElement>("backend-url").value.trim();
    const apiKey = $<HTMLInputElement>("api-key").value.trim();
    if (!backendUrl || !apiKey) {
      setMessage("Backend URL and API key are required.", "err");
      return;
    }
    await chrome.storage.local.set({ navexBackendUrl: backendUrl, navexApiKey: apiKey });
    const response = await send({
      type: "SEND_TO_BACKEND",
      origin: activeOrigin,
      backendUrl,
      apiKey,
    });
    if (response.ok && "detail" in response) {
      setMessage("Map sent to backend.");
    } else if (!response.ok) {
      setMessage(response.error, "err");
    }
  });

  $<HTMLInputElement>("chat-enabled").addEventListener("change", async (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    await chrome.storage.local.set({ navexChatEnabled: enabled });
    const response = await send({ type: "SET_CHAT_ENABLED", enabled });
    if (response.ok && "enabled" in response) {
      setMessage(
        enabled ? "Chat widget enabled on this page." : "Chat widget hidden.",
      );
    }
  });

  $<HTMLButtonElement>("btn-clear").addEventListener("click", async () => {
    const response = await send({ type: "CLEAR_MAP", origin: activeOrigin });
    if (response.ok && "detail" in response) {
      setMessage(response.detail);
    } else if (!response.ok) {
      setMessage(response.error, "err");
    }
    refresh();
  });

  await refresh();
}

chrome.runtime.onMessage.addListener((message: MapperMessage) => {
  if (message.type === "MAP_UPDATED") {
    void refresh();
  }
});

void init();