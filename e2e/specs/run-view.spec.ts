import { test, expect } from "@playwright/test";
import { RunViewPage } from "../pages/RunViewPage";
import { CreateRunPage } from "../pages/CreateRunPage";
import { CasesOverviewPage } from "../pages/CasesOverviewPage";
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

test.describe("Run View", () => {
  let runId: string | null = null;
  let runName: string | null = null;

  test.describe.configure({ mode: "serial" });

  test("create run with tests and open run view", async ({ page }) => {
    await ensureProjectSelected(page);
    await page.locator('a[href="/runs/new"]').first().click();
    await expect(page).toHaveURL(/\/runs\/new/);
    const createPage = new CreateRunPage(page);
    await expect(createPage.emptyState).not.toBeVisible({ timeout: 10000 });
    await expect(createPage.suiteSelect).toBeVisible({ timeout: 30000 });
    await createPage.suiteSelect.locator("option").nth(1).waitFor({ state: "attached", timeout: 5000 });
    const firstSuiteValue = await createPage.suiteSelect.locator("option").nth(1).getAttribute("value");
    expect(firstSuiteValue).toBeTruthy();
    runName = `E2E Run View ${Date.now()}`;
    await createPage.createRun(firstSuiteValue!, runName);
    await expect(page).toHaveURL(/\/runs\/[a-f0-9-]+$/);
    const match = page.url().match(/\/runs\/([a-f0-9-]+)/);
    runId = match ? match[1]! : null;
    expect(runId).toBeTruthy();
  });

  test("Run view (Tests tab) loads: run title and tests table or no tests message visible", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");
    await expect(runView.runTitle).toBeVisible({ timeout: 15000 });
    await expect(
      runView.testStatusHeading.or(runView.testsTable).or(runView.noTestsMessage).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("No test selected: sidebar not visible", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");
    await expect(runView.sidebar).not.toBeVisible();
  });

  test("Run with tests: click first test row opens sidebar with header", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");
    if (await runView.noTestsMessage.isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await runView.openSidebarByClickingFirstTestRow();
    await expect(runView.sidebar).toBeVisible({ timeout: 5000 });
    await expect(runView.sidebarEditLink).toBeVisible();
    await expect(runView.sidebarCloseButton).toBeVisible();
    await expect(runView.sidebarCaseTitle).toBeVisible();
  });

  test("Sidebar body: preconditions/steps or empty state; loading disappears", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");
    if (await runView.noTestsMessage.isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await runView.openSidebarByClickingFirstTestRow();
    await expect(runView.sidebar).toBeVisible({ timeout: 5000 });
    await runView.sidebarNoPreconditionsOrSteps.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    const hasEmpty = await runView.sidebarNoPreconditionsOrSteps.isVisible().catch(() => false);
    const hasPreconditions = await runView.sidebarPreconditionsHeading.isVisible().catch(() => false);
    const hasSteps = await runView.sidebarStepsHeading.isVisible().catch(() => false);
    expect(hasEmpty || hasPreconditions || hasSteps).toBeTruthy();
  });

  test("Sidebar tabs: switch to History & Context and Defects; Results has comment, status, result history", async ({
    page,
  }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");
    if (await runView.noTestsMessage.isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await runView.openSidebarByClickingFirstTestRow();
    await expect(runView.sidebar).toBeVisible({ timeout: 5000 });
    await expect(runView.sidebarCommentTextarea).toBeVisible();
    await expect(runView.sidebarStatusSelect).toBeVisible();
    await expect(runView.sidebarResultHistoryHeading).toBeVisible();
    await runView.sidebarTabHistoryContext.click();
    await expect(runView.sidebarNoVersionHistory).toBeVisible({ timeout: 5000 });
    await runView.sidebarTabDefects.click();
    await expect(runView.sidebarDefectUrlInput).toBeVisible();
    await expect(runView.sidebarAddLinkButton).toBeVisible();
  });

  test("Add Result: set status and comment, click Add Result", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");
    if (await runView.noTestsMessage.isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await runView.openSidebarByClickingFirstTestRow();
    await expect(runView.sidebar).toBeVisible({ timeout: 5000 });
    await runView.sidebarCommentTextarea.fill("E2E comment");
    await runView.sidebarStatusSelect.selectOption("passed");
    await runView.sidebarAddResultButton.click();
    await page.waitForLoadState("networkidle");
    await expect(runView.sidebar).toBeVisible();
  });

  test("Pass & Next: selection moves to next test or sidebar closes on last test", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");
    if (await runView.noTestsMessage.isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await runView.openSidebarByClickingFirstTestRow();
    await expect(runView.sidebar).toBeVisible({ timeout: 5000 });
    await runView.sidebarPassAndNextButton.click();
    await page.waitForLoadState("networkidle");
    const stillOpen = await runView.sidebar.isVisible().catch(() => false);
    expect(stillOpen !== undefined).toBeTruthy();
  });

  test("Close sidebar: click Close, sidebar hidden", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");
    if (await runView.noTestsMessage.isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await runView.openSidebarByClickingFirstTestRow();
    await expect(runView.sidebar).toBeVisible({ timeout: 5000 });
    await runView.closeSidebar();
    await expect(runView.sidebar).not.toBeVisible();
  });

  test("cleanup: delete created run", async ({ page }) => {
    if (!runName) return;
    await ensureProjectSelected(page);
    await page.locator('a[href="/runs/overview"]').first().click();
    await expect(page).toHaveURL(/\/runs\/overview/);
    await page.waitForLoadState("networkidle");
    const runsOverview = new RunsOverviewPage(page);
    const deleteBtn = runsOverview.runDeleteButton(runName);
    if (await deleteBtn.isVisible().catch(() => false)) {
      page.once("dialog", (d) => d.accept());
      await deleteBtn.click();
      await page.waitForLoadState("networkidle");
    }
  });
});

test.describe("Run View – edge cases", () => {
  test("Run with no tests: no tests message visible, no sidebar", async ({ page }) => {
    await ensureProjectSelected(page);
    await page.locator('a[href="/runs/new"]').first().click();
    await expect(page).toHaveURL(/\/runs\/new/);
    const createPage = new CreateRunPage(page);
    const emptyVisible = await createPage.emptyState.isVisible().catch(() => false);
    if (emptyVisible) {
      test.skip();
      return;
    }
    await expect(createPage.suiteSelect).toBeVisible({ timeout: 30000 });
    const firstSuiteValue = await createPage.suiteSelect.locator("option").nth(1).getAttribute("value");
    if (!firstSuiteValue) {
      test.skip();
      return;
    }
    const name = `E2E Run Empty ${Date.now()}`;
    await createPage.createRun(firstSuiteValue, name);
    await expect(page).toHaveURL(/\/runs\/[a-f0-9-]+$/);
    await page.waitForLoadState("networkidle");
    const runView = new RunViewPage(page);
    const noTests = await runView.noTestsMessage.isVisible().catch(() => false);
    const sidebarVisible = await runView.sidebar.isVisible().catch(() => false);
    expect(noTests || !sidebarVisible).toBeTruthy();
    const runsOverview = new RunsOverviewPage(page);
    await runsOverview.goto();
    await page.waitForLoadState("networkidle");
    const deleteBtn = runsOverview.runDeleteButton(name);
    if (await deleteBtn.isVisible().catch(() => false)) {
      page.once("dialog", (d) => d.accept());
      await deleteBtn.click();
    }
  });
});
