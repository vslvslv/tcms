import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression + accessibility tests.
 *
 * These tests require the full stack to be running:
 *   docker compose up --build
 *
 * First run: update snapshots to create baselines:
 *   npm run test:visual -- --update-snapshots
 *
 * Subsequent runs compare against those baselines:
 *   npm run test:visual
 *
 * Accessibility audit (axe-core WCAG 2.1 AA):
 *   npm run test:a11y
 */
export default defineConfig({
  testDir: "./web/tests/visual",
  // Never run visual tests in parallel — prevents GPU/compositor race conditions
  // that cause pixel-level flakiness in screenshots.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["html", { outputFolder: "web/tests/visual/report", open: "never" }]],
  snapshotPathTemplate:
    "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
  use: {
    baseURL: "http://localhost:5001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Stable viewport so snapshots are deterministic across machines
    viewport: { width: 1280, height: 800 },
    // Disable animations so screenshots are not mid-transition
    reducedMotion: "reduce",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
  projects: [
    // Authenticated setup — saves storageState
    {
      name: "visual-setup",
      testMatch: /visual\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Screenshot tests — dark theme
    {
      name: "visual-dark",
      testMatch: /dark\.spec\.ts/,
      dependencies: ["visual-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "web/tests/visual/.auth/user.json",
      },
    },
    // Screenshot tests — light theme
    {
      name: "visual-light",
      testMatch: /light\.spec\.ts/,
      dependencies: ["visual-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "web/tests/visual/.auth/user.json",
      },
    },
    // Accessibility audit
    {
      name: "a11y",
      testMatch: /a11y\.spec\.ts/,
      dependencies: ["visual-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "web/tests/visual/.auth/user.json",
      },
    },
  ],
  outputDir: "web/tests/visual/test-results",
});
