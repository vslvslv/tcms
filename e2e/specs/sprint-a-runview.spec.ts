import { test, expect } from "@playwright/test";
import { RunViewPage } from "../pages/RunViewPage";
import { CreateRunPage } from "../pages/CreateRunPage";
import { RunsOverviewPage } from "../pages/RunsOverviewPage";

async function ensureProjectSelected(page: import("@playwright/test").Page) {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  const backofficeLink = page.getByRole("link", { name: /backoffice/i }).first();
  await backofficeLink.waitFor({ state: "visible", timeout: 15000 });
  await backofficeLink.click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);
  await page.waitForLoadState("networkidle");
}

test.describe("RunView Sprint A Features", () => {
  let runId: string | null = null;
  let runName: string | null = null;

  test.describe.configure({ mode: "serial" });

  test("setup: create run with tests", async ({ page }) => {
    await ensureProjectSelected(page);
    await page.locator('a[href="/runs/new"]').first().click();
    await expect(page).toHaveURL(/\/runs\/new/);
    const createPage = new CreateRunPage(page);
    await expect(createPage.suiteSelect).toBeVisible({ timeout: 30000 });
    await createPage.suiteSelect.locator("option").nth(1).waitFor({ state: "attached", timeout: 5000 });
    const firstSuiteValue = await createPage.suiteSelect.locator("option").nth(1).getAttribute("value");
    expect(firstSuiteValue).toBeTruthy();
    runName = `E2E Sprint-A ${Date.now()}`;
    await createPage.createRun(firstSuiteValue!, runName);
    await expect(page).toHaveURL(/\/runs\/[a-f0-9-]+$/);
    const match = page.url().match(/\/runs\/([a-f0-9-]+)/);
    runId = match ? match[1]! : null;
    expect(runId).toBeTruthy();
  });

  test("shortcuts button is visible and toggles help panel", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");

    const shortcutsBtn = page.getByRole("button", { name: /shortcuts/i });
    await expect(shortcutsBtn).toBeVisible();

    // Click to open shortcuts panel
    await shortcutsBtn.click();
    await expect(page.getByText(/keyboard shortcuts/i)).toBeVisible();
    await expect(page.getByText(/next test/i)).toBeVisible();
    await expect(page.getByText(/mark passed/i)).toBeVisible();
    await expect(page.getByText(/mark failed/i)).toBeVisible();

    // Click again to close
    await shortcutsBtn.click();
    await expect(page.getByText(/keyboard shortcuts/i)).not.toBeVisible();
  });

  test("re-run failures button visible when there are failed tests", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");

    // First add a failed result to make the button appear
    if (await runView.noTestsMessage.isVisible().catch(() => false)) {
      test.skip();
      return;
    }

    // Set first test as failed via sidebar
    await runView.openSidebarByClickingFirstTestRow();
    await expect(runView.sidebar).toBeVisible({ timeout: 5000 });
    await runView.sidebarStatusSelect.selectOption("failed");
    await runView.sidebarAddResultButton.click();
    await page.waitForLoadState("networkidle");
    await runView.closeSidebar();

    // Reload to see updated button
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");

    const rerunBtn = page.getByRole("button", { name: /re-run.*failed/i });
    await expect(rerunBtn).toBeVisible({ timeout: 10000 });
  });

  test("re-run failures creates a new run", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");

    const rerunBtn = page.getByRole("button", { name: /re-run.*failed/i });
    if (!(await rerunBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await rerunBtn.click();
    // Should navigate to the new run or show success
    await page.waitForLoadState("networkidle");
    // The new run should have "(re-run failures)" in the title
    await expect(page.getByText(/re-run failures/i)).toBeVisible({ timeout: 10000 });
  });

  test("cleanup: delete test run", async ({ page }) => {
    if (!runName) return;
    await ensureProjectSelected(page);
    await page.locator('a[href="/runs/overview"]').first().click();
    await expect(page).toHaveURL(/\/runs\/overview/);
    await page.waitForLoadState("networkidle");
    const runsOverview = new RunsOverviewPage(page);
    // Delete original run
    const deleteBtn = runsOverview.runDeleteButton(runName);
    if (await deleteBtn.isVisible().catch(() => false)) {
      page.once("dialog", (d) => d.accept());
      await deleteBtn.click();
      await page.waitForLoadState("networkidle");
    }
    // Delete re-run run
    const rerunDeleteBtn = runsOverview.runDeleteButton(`${runName} (re-run failures)`);
    if (await rerunDeleteBtn.isVisible().catch(() => false)) {
      page.once("dialog", (d) => d.accept());
      await rerunDeleteBtn.click();
      await page.waitForLoadState("networkidle");
    }
  });
});
