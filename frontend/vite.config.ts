import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { DEV_BACKEND_PORT, DEV_FRONTEND_PORT } from "./src/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: DEV_FRONTEND_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${DEV_BACKEND_PORT}`,
        changeOrigin: false,
        ws: false,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
