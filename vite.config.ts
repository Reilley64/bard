import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  root: "src/web",
  plugins: [react()],
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
