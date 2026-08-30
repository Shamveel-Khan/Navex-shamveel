export type ElementType =
  | "button"
  | "input"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "form";

export interface UIElement {
  id: string;
  type: ElementType;
  label: string;
  description?: string;
  disabled?: boolean;
  options?: string[];
}

export interface PageNode {
  path: string;
  title?: string;
  description?: string;
  notes?: string;
  elements: UIElement[];
  truncated?: boolean;
}

export interface SiteMap {
  site: string;
  base_url: string;
  generated_at: string;
  pages: PageNode[];
}

export const ELEMENT_TYPES: readonly ElementType[] = [
  "button",
  "input",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "form",
];

export function isElementType(value: unknown): value is ElementType {
  return typeof value === "string" && (ELEMENT_TYPES as string[]).includes(value);
}

export function validatePageNode(page: PageNode): string[] {
  const errors: string[] = [];
  if (typeof page.path !== "string" || !page.path.startsWith("/")) {
    errors.push(`page.path must start with "/" (got ${JSON.stringify(page.path)})`);
  }
  if (!Array.isArray(page.elements)) {
    errors.push(`page.elements must be an array (got ${JSON.stringify(page.elements)})`);
    return errors;
  }
  const seen = new Set<string>();
  for (const el of page.elements) {
    if (typeof el.id !== "string" || !/^[a-zA-Z0-9_]+$/.test(el.id)) {
      errors.push(`element id must match ^[a-zA-Z0-9_]+$ (got ${JSON.stringify(el.id)})`);
    }
    if (seen.has(el.id)) errors.push(`duplicate element id "${el.id}" on ${page.path}`);
    seen.add(el.id);
    if (!isElementType(el.type)) {
      errors.push(`element "${el.id}" has unknown type ${JSON.stringify(el.type)}`);
    }
    if (typeof el.label !== "string" || el.label.trim().length === 0) {
      errors.push(`element "${el.id}" has an empty label`);
    }
  }
  return errors;
}

export function validateSiteMap(map: SiteMap): string[] {
  const errors: string[] = [];
  if (!map.site || !map.base_url || !Array.isArray(map.pages)) {
    errors.push("map must have site, base_url, and a pages array");
    return errors;
  }
  const paths = new Set<string>();
  for (const page of map.pages) {
    errors.push(...validatePageNode(page).map((e) => `${page.path}: ${e}`));
    if (paths.has(page.path)) errors.push(`duplicate page path "${page.path}"`);
    paths.add(page.path);
  }
  return errors;
}