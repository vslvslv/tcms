import { test, expect } from "@playwright/test";
import { CreateRunPage } from "../pages/CreateRunPage";
import { RunViewPage } from "../pages/RunViewPage";
import { RunsOverviewPage } from "../pages/RunsOverviewPage";
/** Ensure a project is selected by navigating to project detail (URL sets projectId in Layout). */
async function ensureProjectSelected(page: import("@playwright/test").Page) {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  const backofficeLink = page.getByRole("link", { name: /backoffice/i }).first();
  await backofficeLink.waitFor({ state: "visible", timeout: 15000 });
  await backofficeLink.click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);
  await page.waitForLoadState("networkidle");
}

test.describe("Test Runs", () => {
  test("Create Run page shows form", async ({ page }) => {
    const createPage = new CreateRunPage(page);
    await createPage.goto();
    await expect(createPage.pageTitle).toBeVisible();
    const hasForm = await createPage.suiteSelect.isVisible().catch(() => false);
    const hasEmpty = await createPage.emptyState.isVisible().catch(() => false);
    expect(hasForm || hasEmpty).toBeTruthy();
  });

  test("creating a run redirects to run view", async ({ page }) => {
    await ensureProjectSelected(page);
    const addRunLink = page.locator('a[href="/runs/new"]').first();
    await addRunLink.waitFor({ state: "visible", timeout: 10000 });
    await addRunLink.click();
    await expect(page).toHaveURL(/\/runs\/new/);
    await page.waitForLoadState("networkidle");
    const createPage = new CreateRunPage(page);
    await expect(createPage.emptyState).not.toBeVisible({ timeout: 10000 });
    await expect(createPage.suiteSelect).toBeVisible({ timeout: 15000 });
    await createPage.suiteSelect.locator("option").nth(1).waitFor({ state: "attached", timeout: 5000 });
    const firstSuiteValue = await createPage.suiteSelect.locator("option").nth(1).getAttribute("value");
    expect(firstSuiteValue).toBeTruthy();
    const name = `E2E Run ${Date.now()}`;
    await createPage.createRun(firstSuiteValue!, name);
    await expect(page).toHaveURL(/\/runs\/[a-f0-9-]+$/);
    const runView = new RunViewPage(page);
    await expect(runView.runTitle).toBeVisible({ timeout: 10000 });
    await page.locator('a[href="/runs/overview"]').first().click();
    await expect(page).toHaveURL(/\/runs\/overview/);
    await page.waitForLoadState("networkidle");
    const runsOverview = new RunsOverviewPage(page);
    page.once("dialog", (d) => d.accept());
    await runsOverview.runDeleteButton(name).click();
    await page.waitForLoadState("networkidle");
  });
});
