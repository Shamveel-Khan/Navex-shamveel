import {
  containerHeading,
  describe,
  pageDescription,
} from "./descriptors";
import { IdGenerator, WAID_ATTR } from "./ids";
import { normalizePath } from "./routes";
import type { ElementType, PageNode, UIElement } from "../schema";

export const WAID_ATTR_NAME = WAID_ATTR;

export const CANDIDATE_SELECTOR = [
  "button",
  "a[href]",
  "input:not([type='hidden'])",
  "textarea",
  "select",
  "form",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[contenteditable='true']",
].join(", ");

export const DEFAULT_MAX_ELEMENTS = 80;

const FILLABLE_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "password",
  "tel",
  "url",
  "number",
  "date",
  "time",
  "month",
  "week",
  "datetime-local",
  "color",
]);

const SKIP_INPUT_TYPES = new Set([
  "hidden",
  "submit",
  "reset",
  "button",
  "file",
  "image",
]);

const SKIP_ROLES = new Set([
  "presentation",
  "none",
  "tablist",
  "menu",
]);

export interface ScanOptions {
  inject?: boolean;
  maxElements?: number;
  idContext?: IdContextLike;
}

export interface ScanResult {
  page: PageNode;
  injected: number;
}

interface IdContextLike {
  getAuthoredId(el: Element): string | null;
}

export function scanPage(
  doc: Document,
  urlInput: string,
  options: ScanOptions = {},
): ScanResult {
  const url = new URL(urlInput);
  const path = normalizePath(url.pathname);
  const inject = options.inject ?? false;
  const maxElements = options.maxElements ?? DEFAULT_MAX_ELEMENTS;
  const idContext = options.idContext ?? { getAuthoredId: defaultAuthoredId };

  const idGen = new IdGenerator({ getAuthoredId: idContext.getAuthoredId, collisions: 0 });
  const candidates = collectCandidates(doc);
  const detected: Array<{ el: Element; type: ElementType; label: string }> = [];

  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const type = resolveType(el);
    if (type === null) continue;
    const label = resolveLabel(el, type);
    if (!label) continue;
    if (el.matches("[role='button']") && el.querySelector("input, select, textarea")) {
      continue;
    }
    detected.push({ el, type, label });
  }

  const truncated = detected.length > maxElements;
  const selected = truncated ? detected.slice(0, maxElements) : detected;

  const elements: UIElement[] = [];
  let injected = 0;
  let formCount = 0;

  for (const item of selected) {
    const { id, authored } = idGen.assign(item.el, item.type, item.label);
    if (inject && !authored) {
      if (!item.el.hasAttribute(WAID_ATTR)) {
        item.el.setAttribute(WAID_ATTR, id);
        injected += 1;
      }
    }
    if (item.type === "form") formCount += 1;

    const element: UIElement = { id, type: item.type, label: item.label };
    const description = describe(item.el, item.type, item.label);
    if (description) element.description = description;
    if (isDisabled(item.el)) element.disabled = true;
    if (item.type === "select") {
      const select = item.el as HTMLSelectElement;
      const optionsList = Array.from(select.options)
        .map((o) => o.value)
        .filter((v) => v.trim().length > 0);
      if (optionsList.length > 0) element.options = optionsList;
    }
    elements.push(element);
  }

  const title = doc.title || headingTitle(doc);

  const page: PageNode = {
    path,
    title: title || undefined,
    description: pageDescription(doc, path, title, elements.length, formCount),
    elements,
    ...(truncated ? { truncated: true } : {}),
  };

  return { page, injected };
}

function headingTitle(doc: Document): string {
  const h = doc.querySelector("h1");
  return h?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function defaultAuthoredId(el: Element): string | null {
  return el.getAttribute(WAID_ATTR);
}

function collectCandidates(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll<Element>(CANDIDATE_SELECTOR));
}

export function resolveType(el: Element): ElementType | null {
  const tag = el.tagName;
  if (tag === "FORM") return "form";
  if (tag === "TEXTAREA") return "textarea";
  if (tag === "SELECT") return "select";
  if (tag === "A") return "button";
  if (tag === "INPUT") {
    const input = el as HTMLInputElement;
    const inputType = (input.type || "text").toLowerCase();
    if (SKIP_INPUT_TYPES.has(inputType)) return null;
    if (inputType === "checkbox") return "checkbox";
    if (inputType === "radio") return "radio";
    return FILLABLE_INPUT_TYPES.has(inputType) ? "input" : null;
  }
  const role = el.getAttribute("role")?.toLowerCase() ?? "";
  if (SKIP_ROLES.has(role)) return null;
  if (role === "checkbox") return "checkbox";
  if (role === "radio") return "radio";
  if (role === "link") return "button";
  if (el.getAttribute("contenteditable") === "true") return "textarea";
  if (tag === "BUTTON") return "button";
  // An element with an explicit role that is clickable-ish
  if (role === "button" || role === "switch" || role === "tab" || role === "menuitem") {
    return "button";
  }
  return null;
}

export function resolveLabel(el: Element, type: ElementType): string {
  const aria = el.getAttribute("aria-label");
  if (aria?.trim()) return normalize(aria);

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const refText = labelledBy
      .split(/\s+/)
      .map((id) => {
        let owner = el.ownerDocument;
        const ref = owner?.getElementById(id);
        return ref?.textContent ?? "";
      })
      .join(" ")
      .trim();
    if (refText) return normalize(refText);
  }

  if (el instanceof HTMLFormElement) {
    const heading = containerHeading(el);
    if (heading) return normalize(heading);
    return normalize(el.getAttribute("name") ?? el.getAttribute("id") ?? "form");
  }

  const wrappingLabel = el.closest("label");
  if (wrappingLabel?.textContent?.trim()) {
    const text = wrappingLabel.textContent.replace(/\s+/g, " ").trim();
    if (text) return normalize(text);
  }

  if (el.id) {
    const owner = el.ownerDocument;
    const bound = owner?.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (bound?.textContent?.trim()) return normalize(bound.textContent);
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.placeholder?.trim()) return normalize(el.placeholder);
  }

  const text = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
  if (text && type !== "input" && type !== "checkbox" && type !== "radio") {
    return normalize(text);
  }

  const name = el.getAttribute("name");
  if (name?.trim()) return normalize(name);

  return "";
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isVisible(el: Element): boolean {
  const doc = el.ownerDocument;
  const view = doc.defaultView ?? window;
  let node: Element | null = el;
  while (node) {
    if (node.getAttribute("aria-hidden") === "true") return false;
    if (node.hasAttribute("hidden")) return false;
    const inline = (node as HTMLElement).style;
    if (inline && (inline.display === "none" || inline.visibility === "hidden")) {
      return false;
    }
    const computed = view.getComputedStyle(node);
    if (computed.display === "none" || computed.visibility === "hidden") {
      return false;
    }
    node = node.parentElement;
  }
  // getBoundingClientRect is unreliable without a layout engine (headless
  // tests), so the ancestor style walk above is the source of truth.
  return true;
}

function isDisabled(el: Element): boolean {
  const native = el instanceof HTMLElement && "disabled" in el && Boolean((el as HTMLButtonElement).disabled);
  if (native) return true;
  return el.getAttribute("aria-disabled") === "true";
}