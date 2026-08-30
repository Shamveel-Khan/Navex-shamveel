import { accessSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const dist = resolve(root, "dist");
mkdirSync(dist, { recursive: true });
copyFileSync(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));
copyFileSync(resolve(root, "icons", "icon.svg"), resolve(dist, "icon.svg"));

// Vite nests HTML from src/ subfolders (dist/src/popup/popup.html); hoist it
// to the dist root so the manifest's "default_popup": "popup.html" resolves.
const nestedPopup = resolve(dist, "src", "popup", "popup.html");
try {
  accessSync(nestedPopup);
  const html = readFileSync(nestedPopup, "utf8");
  // Rewrite /assets/popup.js → ./assets/popup.js so it resolves relative to popup.html.
  const fixed = html.replace('src="/assets/popup.js"', 'src="./assets/popup.js"');
  writeFileSync(resolve(dist, "popup.html"), fixed);
  rmSync(resolve(dist, "src"), { recursive: true, force: true });
  console.log("hoisted popup.html to dist root");
} catch {
  console.error("WARNING: dist/src/popup/popup.html not found; skipping hoist");
}

console.log("copied manifest.json + icons to dist/");