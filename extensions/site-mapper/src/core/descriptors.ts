import type { ElementType } from "../schema";

const OPTION_PREVIEW_LIMIT = 4;

export function containerHeading(el: Element): string {
  const container =
    el.closest("dialog, [role='dialog'], [class*='modal']") ??
    el.closest("header, [class*='header'], [class*='panel'], [class*='card']");
  if (!container) return "";
  const heading = container.querySelector("h1, h2, h3");
  return heading?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export function formLabel(form: HTMLFormElement): string {
  const heading = containerHeading(form);
  if (heading) return heading;
  const first = form.querySelector(
    "button[type='submit'], input[type='submit'], button:not([type])",
  );
  const firstText = first?.textContent?.trim();
  if (firstText) return `${firstText} form`;
  return "the form";
}

export function describe(el: Element, type: ElementType, label: string): string {
  const normalized = label.toLowerCase();
  const fallback = `Interacts with "${label}"`;

  switch (type) {
    case "form": {
      const heading = containerHeading(el);
      return heading ? `Form for ${heading}` : `The ${formLabel(el as HTMLFormElement)}`;
    }
    case "button": {
      const button = el as HTMLButtonElement;
      const form = button.form;
      if ((button.type === "submit" || !button.hasAttribute("type")) && form) {
        return `Submits the ${formLabel(form)}`;
      }
      if (button.getAttribute("aria-haspopup") || button.dataset.menuButton !== undefined) {
        return `Opens the ${label} dialog or menu`;
      }
      if (button.getAttribute("aria-expanded") === "true" || button.getAttribute("aria-expanded") === "false") {
        return `Toggles the ${label} section`;
      }
      return `Triggers ${label}`;
    }
    case "textarea":
      return `Enters long text for ${label}`;
    case "input":
      return `Enters ${label}`;
    case "select": {
      const options = Array.from((el as HTMLSelectElement).options)
        .map((o) => o.text.trim())
        .filter(Boolean);
      if (options.length === 0) return `Chooses ${label}`;
      const shown = options.slice(0, OPTION_PREVIEW_LIMIT).join(", ");
      const more = options.length > OPTION_PREVIEW_LIMIT ? `, …` : "";
      return `Chooses one of: ${shown}${more}`;
    }
    case "checkbox":
    case "radio":
      return `Toggles ${label}`;
    default:
      return fallback;
  }
}

export function pageDescription(
  doc: Document,
  routePath: string,
  title: string,
  elementCount: number,
  formCount: number,
): string {
  const headings = Array.from(doc.querySelectorAll("h1"))
    .map((h) => h.textContent?.replace(/\s+/g, " ").trim())
    .filter((t): t is string => Boolean(t));
  const headingText = headings[0] ?? title;
  const parts = [headingText ? `Page for ${headingText}` : `Page at ${routePath}`];
  const groups = [
    elementCount > 0 ? `${elementCount} interactive element(s)` : "no interactive elements found",
  ];
  if (formCount > 0) groups.push(`${formCount} form(s)`);
  parts.push(groups.join(", "));
  return parts.join(". ") + ".";
}