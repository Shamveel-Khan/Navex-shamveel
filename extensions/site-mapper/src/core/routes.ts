export function normalizePath(input: string): string {
  let path = input;
  try {
    const url = new URL(input, "http://localhost");
    path = url.pathname;
  } catch {
    // not a parseable URL; treat as a bare path
  }
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (!path.startsWith("/")) path = "/" + path;
  return path || "/";
}

export function isInternalLink(anchor: HTMLAnchorElement, origin: string): boolean {
  const href = anchor.getAttribute("href");
  if (!href) return false;
  const trimmed = href.trim();
  if (
    trimmed === "" ||
    trimmed === "#" ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return false;
  }
  try {
    const url = new URL(trimmed, origin);
    return url.origin === origin;
  } catch {
    return false;
  }
}

export interface LinkTarget {
  path: string;
  label: string;
}

export function collectInternalLinks(doc: Document, origin: string): LinkTarget[] {
  const seen = new Map<string, string>();
  for (const anchor of Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    if (!isInternalLink(anchor, origin)) continue;
    if (anchor.getAttribute("aria-hidden") === "true") continue;
    const rect = anchor.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      const style = window.getComputedStyle(anchor);
      if (style.display === "none" || style.visibility === "hidden") continue;
    }
    const url = new URL(anchor.getAttribute("href") as string, origin);
    const path = normalizePath(url.pathname);
    if (path === "/") continue;
    const label =
      anchor.getAttribute("aria-label")?.trim() ??
      anchor.textContent?.replace(/\s+/g, " ").trim() ??
      path;
    if (!label) continue;
    if (!seen.has(path)) seen.set(path, label);
  }
  return Array.from(seen.entries()).map(([path, label]) => ({ path, label }));
}