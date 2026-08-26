import { FILLABLE_INPUT_TYPES, observe, WAID_ATTR } from "./observer";
import type { ActionResult, AgentAction } from "./types";

export class ActionError extends Error {}

export interface ExecutorOptions {
  navigate: (path: string) => void;
  settleMs?: number;
  navigationTimeoutMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeId(id: string): string {
  return typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(id)
    : id.replace(/"/g, '\\"');
}

function findWaid(id: string, expectedTag?: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(
    `[${WAID_ATTR}="${escapeId(id)}"]`,
  );
  if (!el) {
    throw new ActionError(
      `element_not_found: no visible DOM node with data-waid "${id}"`,
    );
  }
  if (expectedTag && el.tagName !== expectedTag) {
    throw new ActionError(
      `wrong_element_type: data-waid "${id}" is <${el.tagName.toLowerCase()}>, expected <${expectedTag.toLowerCase()}>`,
    );
  }
  return el;
}

function requireEnabled(el: HTMLElement): void {
  const nativelyDisabled =
    "disabled" in el && Boolean((el as HTMLButtonElement).disabled);
  if (nativelyDisabled || el.getAttribute("aria-disabled") === "true") {
    throw new ActionError(
      `element_disabled: "${el.getAttribute(WAID_ATTR)}" is disabled`,
    );
  }
}

function fireValueEvents(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): void {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  fireValueEvents(el);
}

async function waitForPath(path: string, timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (window.location.pathname !== path) {
    if (performance.now() > deadline) {
      throw new ActionError(
        `navigation_failed: expected "${path}", still on "${window.location.pathname}"`,
      );
    }
    await sleep(50);
  }
}

export function createExecutor(options: ExecutorOptions) {
  const settleMs = options.settleMs ?? 350;
  const navigationTimeoutMs = options.navigationTimeoutMs ?? 2000;

  async function run(action: AgentAction): Promise<void> {
    switch (action.type) {
      case "navigate": {
        if (!action.path.startsWith("/")) {
          throw new ActionError(`invalid_path: "${action.path}"`);
        }
        options.navigate(action.path);
        await waitForPath(action.path, navigationTimeoutMs);
        return;
      }
      case "click": {
        const el = findWaid(action.element_id);
        requireEnabled(el);
        el.scrollIntoView({ block: "center" });
        el.click();
        return;
      }
      case "fill": {
        const el = findWaid(action.element_id);
        requireEnabled(el);
        if (
          el instanceof HTMLTextAreaElement ||
          (el instanceof HTMLInputElement &&
            FILLABLE_INPUT_TYPES.has(el.type))
        ) {
          setNativeValue(el, action.value);
          return;
        }
        throw new ActionError(
          `unsupported_element: "${action.element_id}" (<${el.tagName.toLowerCase()}>) cannot be filled`,
        );
      }
      case "select": {
        const el = findWaid(action.element_id);
        requireEnabled(el);
        if (!(el instanceof HTMLSelectElement)) {
          throw new ActionError(
            `unsupported_element: "${action.element_id}" is not a <select>`,
          );
        }
        const match = Array.from(el.options).find(
          (option) =>
            option.value === action.value ||
            option.text.trim() === action.value,
        );
        if (!match) {
          throw new ActionError(
            `invalid_option: "${action.value}" not in [${Array.from(el.options)
              .map((option) => option.value)
              .join(", ")}]`,
          );
        }
        el.value = match.value;
        fireValueEvents(el);
        return;
      }
      case "submit": {
        const el = findWaid(action.form_id, "FORM");
        requireEnabled(el);
        (el as HTMLFormElement).requestSubmit();
        return;
      }
    }
  }

  async function execute(action: AgentAction): Promise<ActionResult> {
    try {
      await run(action);
    } catch (err) {
      await sleep(50);
      const message =
        err instanceof Error ? err.message : String(err);
      return { status: "failed", error: message, page: observe() };
    }
    await sleep(settleMs);
    return { status: "success", page: observe() };
  }

  return { execute };
}
