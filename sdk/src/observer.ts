import type { ElementType, PageState, UIElement } from "./types";

export const WAID_ATTR = "data-waid";

const FILLABLE_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "password",
  "tel",
  "url",
  "number",
]);

function truncate(value: string, max = 120): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function resolveLabel(el: HTMLElement): string {
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel?.trim()) return truncate(ariaLabel.trim());

  const wrappingLabel = el.closest("label");
  if (wrappingLabel?.textContent?.trim()) {
    return truncate(wrappingLabel.textContent.trim());
  }

  if (el.id) {
    const bound = document.querySelector(
      `label[for="${CSS.escape(el.id)}"]`,
    );
    if (bound?.textContent?.trim()) return truncate(bound.textContent.trim());
  }

  const text = el.textContent?.trim() ?? "";
  if (text) return truncate(text);

  const placeholder = el.getAttribute("placeholder");
  if (placeholder?.trim()) return truncate(placeholder.trim());

  return truncate(el.getAttribute("name") ?? "");
}

function resolveType(el: Element): ElementType {
  const tag = el.tagName;
  if (tag === "FORM") return "form";
  if (tag === "TEXTAREA") return "textarea";
  if (tag === "SELECT") return "select";
  if (tag === "INPUT") {
    const inputType = (el as HTMLInputElement).type;
    if (inputType === "checkbox") return "checkbox";
    if (inputType === "radio") return "radio";
    return "input";
  }
  return "button";
}

function toUIElement(el: HTMLElement): UIElement {
  const element: UIElement = {
    id: el.getAttribute(WAID_ATTR) ?? "",
    type: resolveType(el),
    label: resolveLabel(el),
  };

  const nativelyDisabled =
    "disabled" in el && Boolean((el as HTMLButtonElement).disabled);
  if (nativelyDisabled || el.getAttribute("aria-disabled") === "true") {
    element.disabled = true;
  }

  if (element.type === "select") {
    element.options = Array.from((el as HTMLSelectElement).options).map(
      (option) => option.value,
    );
  }

  return element;
}

export function observe(): PageState {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(`[${WAID_ATTR}]`),
  );
  return {
    path: window.location.pathname,
    title: document.title,
    elements: nodes.filter(isVisible).map(toUIElement),
  };
}

export { FILLABLE_INPUT_TYPES };
