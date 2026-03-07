import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests target the web app. Ensure the API is running (e.g. http://localhost:3001)
 * and the web dev server is running (http://localhost:5001) before running tests.
 * globalSetup runs the Backoffice seed so cases/runs tests have project/sections/suites.
 */
export default defineConfig({
  testDir: "./e2e/specs",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5001",
    trace: "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
      testIgnore: [/login\.spec\.ts/],
    },
    {
      name: "chromium-unauth",
      use: { ...devices["Desktop Chrome"] },
      testMatch: [/login\.spec\.ts/],
    },
  ],
  outputDir: "e2e/test-results",
});
