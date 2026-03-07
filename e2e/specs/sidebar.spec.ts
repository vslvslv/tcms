import { test, expect } from "@playwright/test";
import { Sidebar } from "../pages/Sidebar";

test.describe("Sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const backofficeLink = page.getByRole("link", { name: /backoffice/i }).first();
    if (await backofficeLink.isVisible().catch(() => false)) {
      await backofficeLink.click();
    } else {
      await page.getByRole("link", { name: /view/i }).first().click();
    }
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);
  });

  test("shows main navigation", async ({ page }) => {
    const sidebar = new Sidebar(page);
    await expect(sidebar.nav).toBeVisible();
  });

  test("navigates to Cases Overview", async ({ page }) => {
    const sidebar = new Sidebar(page);
    await sidebar.goToCasesOverview();
    await expect(page).toHaveURL(/\/cases\/overview/);
  });

  test("navigates to Test Runs Overview", async ({ page }) => {
    const sidebar = new Sidebar(page);
    await sidebar.goToRunsOverview();
    await expect(page).toHaveURL(/\/runs\/overview/);
  });
});
