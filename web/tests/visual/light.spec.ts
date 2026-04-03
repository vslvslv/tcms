import { test, expect } from "@playwright/test";

/**
 * Visual regression baselines — light theme.
 *
 * Same 5 pages as dark.spec.ts — mirrored for light theme.
 *
 * First run (create baselines):
 *   npm run test:visual -- --update-snapshots --project visual-light
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("tcms-theme", "light");
  });
});

test("dashboard — light", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("dashboard-light.png", {
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});

test("projects list — light", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(200);
  await expect(page).toHaveScreenshot("projects-light.png", {
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});

test("cases overview — light", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");

  const firstProject = page.getByRole("link").filter({ hasText: /backoffice/i }).first();
  await firstProject.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(200);

  await expect(page).toHaveScreenshot("cases-overview-light.png", {
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});

test("runs overview — light", async ({ page }) => {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");

  const firstProject = page.getByRole("link").filter({ hasText: /backoffice/i }).first();
  await firstProject.click();
  await page.waitForLoadState("networkidle");

  const runsLink = page.getByRole("link", { name: /runs/i }).first();
  await runsLink.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(200);

  await expect(page).toHaveScreenshot("runs-overview-light.png", {
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});

test("login page — light", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("tcms-theme", "light");
  });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(200);

  await expect(page).toHaveScreenshot("login-light.png", {
    fullPage: false,
    maxDiffPixelRatio: 0.02,
  });
});
