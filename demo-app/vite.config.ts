import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@navex/sdk": fileURLToPath(
        new URL("../sdk/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [".."],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  css: {
    postcss: {},
  },
});

