import type { PageNode, SiteMap } from "./schema";
import type { LinkTarget } from "./core/routes";

export type MapperMessage =
  | { type: "PAGE_SCANNED"; origin: string; site: string; baseUrl: string; page: PageNode; links: LinkTarget[] }
  | { type: "SCAN_NOW"; origin: string }
  | { type: "GET_MAP"; origin: string }
  | { type: "GET_STATE"; origin: string }
  | { type: "EXPORT_MAP"; origin: string }
  | { type: "SEND_TO_BACKEND"; origin: string; backendUrl: string; apiKey: string }
  | { type: "SEND_FULL_MAP"; origin: string; backendUrl: string; apiKey: string; site: string }
  | { type: "CLEAR_MAP"; origin: string }
  | { type: "VISIT_PATH"; path: string }
  | { type: "MAP_UPDATED"; map: SiteMap }
  | { type: "HTTP_RELAY"; path: string; body: unknown }
  | { type: "ENSURE_MAP"; origin: string; site: string; baseUrl: string; page: PageNode }
  | { type: "GET_CONFIG" }
  | { type: "GET_CHAT_ENABLED" }
  | { type: "SET_CHAT_ENABLED"; enabled: boolean };

export type MapperResponse =
  | { ok: true; map: SiteMap | null }
  | { ok: true; state: { pages: number; elements: number; unvisited: LinkTarget[] } }
  | { ok: true; json: string }
  | { ok: true; detail: string }
  | { ok: true; relay: { ok: boolean; status: number; bodyText: string } }
  | { ok: true; config: { backendUrl: string; apiKey: string; enabled: boolean } }
  | { ok: true; enabled: boolean }
  | { ok: true; sent: { site: string; pages: number; elements: number } }
  | { ok: false; error: string };

export interface UnitResult {
  unit: string;
  detail: string;
}