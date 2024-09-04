import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

// https://vitejs.dev/config/
export default defineConfig({
  root: path.resolve(__dirname, "./src/web"),
  plugins: [TanStackRouterVite(), react()],
  build: {
    outDir: path.resolve(__dirname, "./public"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src/web/src"),
    },
  },
});
