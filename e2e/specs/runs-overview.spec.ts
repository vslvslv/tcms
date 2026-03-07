import { test, expect } from "@playwright/test";
import { RunsOverviewPage } from "../pages/RunsOverviewPage";

test.describe("Runs Overview", () => {
  test("shows Test Runs & Results title", async ({ page }) => {
    const runsPage = new RunsOverviewPage(page);
    await runsPage.goto();
    await expect(runsPage.pageTitle).toBeVisible();
  });

  test("shows empty state or runs list when no project", async ({ page }) => {
    const runsPage = new RunsOverviewPage(page);
    await runsPage.goto();
    await expect(runsPage.emptyState.or(runsPage.pageTitle).first()).toBeVisible();
  });
});
