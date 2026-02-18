import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "single-entry",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:4173",
      },
      testMatch: /\/(build|hydration|client-init)\.spec\.ts$/,
    },
    {
      name: "multi-entry",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:4174",
      },
      testMatch: /\/multi-entry\.spec\.ts$/,
    },
    {
      name: "ssr-defer",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:4177",
      },
      testMatch: /\/ssr-defer\.spec\.ts$/,
    },
  ],

  webServer: [
    {
      command:
        "cd fixture && pnpm vite build && pnpm dlx serve -p 4173 dist/public",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command:
        "cd fixture-multi-entry && pnpm vite build && pnpm dlx serve -p 4174 dist/public",
      url: "http://localhost:4174",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command:
        "cd fixture-ssr-defer && pnpm vite build && pnpm dlx serve -p 4177 dist/public",
      url: "http://localhost:4177",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
