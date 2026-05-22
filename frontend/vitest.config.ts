import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["src/e2e/**", "node_modules/**", ".next/**"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
