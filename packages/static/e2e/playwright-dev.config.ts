import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-dev",
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
      name: "single-entry-dev",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:4175",
      },
      testMatch: /\/(dev-server|hydration|client-init)\.spec\.ts$/,
    },
    {
      name: "multi-entry-dev",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:4176",
      },
      testMatch: /\/multi-entry\.spec\.ts$/,
    },
  ],

  webServer: [
    {
      command: "cd fixture && pnpm vite dev --port 4175 --strictPort",
      url: "http://localhost:4175/@vite/client",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command:
        "cd fixture-multi-entry && pnpm vite dev --port 4176 --strictPort",
      url: "http://localhost:4176/@vite/client",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
