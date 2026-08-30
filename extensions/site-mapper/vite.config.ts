import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: ".",
  resolve: {
    alias: {
      "@navex/sdk": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
