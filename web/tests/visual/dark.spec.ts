import { test, expect } from "@playwright/test";

/**
 * Visual regression baselines — dark theme.
 *
 * Pages covered:
 *   1. /dashboard
 *   2. /projects (list)
 *   3. Cases overview (first project → suites)
 *   4. Runs overview
 *   5. Login page (unauthenticated — captures theme in dark mode)
 *
 * First run (create baselines):
 *   npm run test:visual -- --update-snapshots --project visual-dark
 *
 * After UI changes, intentionally update baselines:
 *   npm run test:visual -- --update-snapshots --project visual-dark
 */

// Force dark theme via localStorage before each test
test.beforeEach(async ({ page }) => {
  // Inject theme before navigation so the page loads with the right theme
  await page.addInitScript(() => {
    window.localStorage.setItem("tcms-theme", "dark");
  });
});

test("dashboard — dark", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  // Collapse any animated counters by waiting for them to settle
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("dashboard-dark.png", {
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});

test("projects list — dark", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(200);
  await expect(page).toHaveScreenshot("projects-dark.png", {
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});

test("cases overview — dark", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");

  // Click the first project card
  const firstProject = page.getByRole("link").filter({ hasText: /backoffice/i }).first();
  await firstProject.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(200);

  await expect(page).toHaveScreenshot("cases-overview-dark.png", {
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});

test("runs overview — dark", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");

  const firstProject = page.getByRole("link").filter({ hasText: /backoffice/i }).first();
  await firstProject.click();
  await page.waitForLoadState("networkidle");

  // Navigate to runs tab
  const runsLink = page.getByRole("link", { name: /runs/i }).first();
  await runsLink.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(200);

  await expect(page).toHaveScreenshot("runs-overview-dark.png", {
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});

test("login page — dark", async ({ page }) => {
  // Login page doesn't need auth — force dark before navigation
  await page.addInitScript(() => {
    window.localStorage.setItem("tcms-theme", "dark");
  });
  // Navigate directly without auth state
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(200);

  await expect(page).toHaveScreenshot("login-dark.png", {
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});
