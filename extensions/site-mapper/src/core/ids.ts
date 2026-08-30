import type { ElementType } from "../schema";

export const WAID_ATTR = "data-waid";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

const TYPE_SUFFIX: Record<ElementType, string> = {
  button: "button",
  input: "input",
  textarea: "textarea",
  select: "select",
  checkbox: "checkbox",
  radio: "radio",
  form: "form",
};

export function composeId(base: string, type: ElementType): string {
  const slug = slugify(base) || "element";
  return `${slug}_${TYPE_SUFFIX[type]}`;
}

export function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

export interface IdContext {
  getAuthoredId(el: Element): string | null;
  collisions: number;
}

export interface IdResult {
  id: string;
  authored: boolean;
}

export class IdGenerator {
  private readonly used = new Map<string, Element>();
  private readonly assigned = new WeakMap<Element, string>();
  private ordinalByTag = new Map<string, number>();
  collisions = 0;

  constructor(private readonly context: IdContext = { getAuthoredId: defaultAuthoredId, collisions: 0 }) {}

  assign(el: Element, type: ElementType, label: string): IdResult {
    const existing = this.assigned.get(el);
    if (existing) return { id: existing, authored: false };

    const authored = this.context.getAuthoredId(el);
    if (authored) {
      this.used.set(authored, el);
      this.assigned.set(el, authored);
      return { id: authored, authored: true };
    }

    const base = slugify(label);
    let candidate: string;
    if (base) {
      candidate = composeId(base, type);
      let suffix = 2;
      while (this.used.has(candidate) && this.used.get(candidate) !== el) {
        candidate = `${composeId(base, type)}_${suffix++}`;
      }
    } else {
      const ordinal = (this.ordinalByTag.get(type) ?? 0) + 1;
      this.ordinalByTag.set(type, ordinal);
      candidate = `el_${type}_${ordinal}`;
      let suffix = 2;
      while (this.used.has(candidate) && this.used.get(candidate) !== el) {
        candidate = `el_${type}_${ordinal}_${suffix++}`;
      }
    }
    this.used.set(candidate, el);
    this.assigned.set(el, candidate);
    return { id: candidate, authored: false };
  }
}

function defaultAuthoredId(el: Element): string | null {
  return el.getAttribute(WAID_ATTR);
}