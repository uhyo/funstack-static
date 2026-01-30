import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/vitest.setup.ts"],
    globals: true,
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});
