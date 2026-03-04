import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const rootNodeModules = path.resolve(__dirname, "..", "..", "node_modules");

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      react: path.join(rootNodeModules, "react"),
      "react-dom": path.join(rootNodeModules, "react-dom")
    }
  },
  server: {
    proxy: {
      "/api": "http://localhost:4000"
    }
  }
});