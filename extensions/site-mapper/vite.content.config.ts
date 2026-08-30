import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  resolve: {
    alias: {
      "@navex/sdk": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, "src/content.ts"),
        background: resolve(__dirname, "src/background.ts"),
        popup: resolve(__dirname, "src/popup/popup.html"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "content") return "content.js";
          if (chunk.name === "background") return "background.js";
          return "assets/[name].js";
        },
      },
    },
    target: "es2022",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
