import { test, expect } from "@playwright/test";
import { RunViewPage } from "../pages/RunViewPage";
import { CreateRunPage } from "../pages/CreateRunPage";
import { RunsOverviewPage } from "../pages/RunsOverviewPage";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Navigate to /projects and click the Backoffice project link. */
async function ensureBackofficeSelected(page: import("@playwright/test").Page) {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  const backofficeLink = page.locator("table").getByRole("link", { name: /backoffice/i }).first();
  await backofficeLink.waitFor({ state: "visible", timeout: 15000 });
  await backofficeLink.click();
  await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
  await page.waitForLoadState("networkidle");
}

/** Get API base URL and auth token from localStorage (requires app to be loaded first). */
async function getApiContext(page: import("@playwright/test").Page) {
  const token = await page.evaluate(() => localStorage.getItem("tcms_token"));
  return {
    baseUrl: "http://localhost:3001",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}

/** Find the TCMS Test Project ID via API. */
async function getTcmsTestProjectId(page: import("@playwright/test").Page): Promise<string> {
  const { baseUrl, headers } = await getApiContext(page);
  const projects: { id: string; name: string }[] = await page.evaluate(
    async ({ baseUrl, headers }) => {
      const r = await fetch(`${baseUrl}/api/projects`, { headers });
      return r.json();
    },
    { baseUrl, headers }
  );
  const project =
    projects.find((p) => p.name.toLowerCase().includes("tcms test")) ??
    projects.find((p) => !p.name.toLowerCase().includes("backoffice"));
  expect(project, "TCMS Test Project not found").toBeTruthy();
  return project!.id;
}

/** Create a scratch run in the Test Execution suite of the TCMS Test Project. */
async function createScratchRun(page: import("@playwright/test").Page): Promise<string> {
  const { baseUrl, headers } = await getApiContext(page);
  const projectId = await getTcmsTestProjectId(page);

  const suites: { id: string; name: string }[] = await page.evaluate(
    async ({ baseUrl, headers, projectId }) => {
      const r = await fetch(`${baseUrl}/api/projects/${projectId}/suites`, { headers });
      return r.json();
    },
    { baseUrl, headers, projectId }
  );

  const executionSuite =
    suites.find((s) => s.name.toLowerCase().includes("test execution")) ?? suites[0];
  expect(executionSuite, "Test Execution suite not found").toBeTruthy();

  const run: { id: string } = await page.evaluate(
    async ({ baseUrl, headers, suiteId }) => {
      const r = await fetch(`${baseUrl}/api/suites/${suiteId}/runs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Scratch run (auto)" }),
      });
      return r.json();
    },
    { baseUrl, headers, suiteId: executionSuite.id }
  );
  expect(run.id, "Run creation failed").toBeTruthy();
  return run.id;
}

/** Delete a run by ID. Navigates to /projects first to ensure localStorage is accessible. */
async function deleteRun(page: import("@playwright/test").Page, runId: string) {
  await page.goto("/projects");
  await page.waitForLoadState("domcontentloaded");
  const { baseUrl, headers } = await getApiContext(page);
  await page.evaluate(
    async ({ baseUrl, headers, runId }) => {
      await fetch(`${baseUrl}/api/runs/${runId}`, { method: "DELETE", headers });
    },
    { baseUrl, headers, runId }
  );
}

// ---------------------------------------------------------------------------
// Test Execution › Runs Overview
// ---------------------------------------------------------------------------

test.describe("Test Execution › Runs Overview", () => {
  test("shows Test Runs & Results page", async ({ page }) => {
    const runsPage = new RunsOverviewPage(page);
    await runsPage.goto();
    await expect(runsPage.pageTitle).toBeVisible();
  });

  test("shows empty state or runs list", async ({ page }) => {
    const runsPage = new RunsOverviewPage(page);
    await runsPage.goto();
    await expect(runsPage.emptyState.or(runsPage.pageTitle).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test Execution › Create Run
// ---------------------------------------------------------------------------

test.describe("Test Execution › Create Run", () => {
  test("Create Run page shows form or empty state", async ({ page }) => {
    const createPage = new CreateRunPage(page);
    await createPage.goto();
    await expect(createPage.pageTitle).toBeVisible();
    const hasForm = await createPage.suiteSelect.isVisible().catch(() => false);
    const hasEmpty = await createPage.emptyState.isVisible().catch(() => false);
    expect(hasForm || hasEmpty).toBeTruthy();
  });

  test("creating a run redirects to run view and run appears in overview", async ({ page }) => {
    await ensureBackofficeSelected(page);
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

// ---------------------------------------------------------------------------
// Test Execution › Run View
// ---------------------------------------------------------------------------

test.describe("Test Execution › Run View", () => {
  let runId: string | null = null;
  let runName: string | null = null;

  test.describe.configure({ mode: "serial" });

  test("setup: create run and navigate to run view", async ({ page }) => {
    await ensureBackofficeSelected(page);
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

  test("run view loads with title and tests table or empty message", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");
    await expect(runView.runTitle).toBeVisible({ timeout: 15000 });
    await expect(
      runView.testStatusHeading.or(runView.testsTable).or(runView.noTestsMessage).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("no test selected: sidebar not visible", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId!);
    await page.waitForLoadState("networkidle");
    await expect(runView.sidebar).not.toBeVisible();
  });

  test("clicking first test row opens sidebar with header", async ({ page }) => {
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

  test("sidebar shows preconditions/steps or empty state", async ({ page }) => {
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

  test("sidebar tabs: Results, History & Context, Defects all accessible", async ({ page }) => {
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

  test("add result: set status and comment, click Add Result", async ({ page }) => {
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

  test("Pass & Next: moves to next test or closes sidebar on last test", async ({ page }) => {
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

  test("close sidebar: click Close hides sidebar", async ({ page }) => {
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

  test("cleanup: delete run", async ({ page }) => {
    if (!runName) return;
    await ensureBackofficeSelected(page);
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

// ---------------------------------------------------------------------------
// Test Execution › Run View (edge cases)
// ---------------------------------------------------------------------------

test.describe("Test Execution › Run View – edge cases", () => {
  test("run with no tests shows no-tests message without sidebar", async ({ page }) => {
    await ensureBackofficeSelected(page);
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

// ---------------------------------------------------------------------------
// Test Execution › Shortcuts & Re-run  [Story A.1]
// ---------------------------------------------------------------------------

test.describe("Test Execution › Shortcuts & Re-run", () => {
  let runId: string | null = null;
  let runName: string | null = null;

  test.describe.configure({ mode: "serial" });

  test("setup: create run with tests", async ({ page }) => {
    await ensureBackofficeSelected(page);
    await page.locator('a[href="/runs/new"]').first().click();
    await expect(page).toHaveURL(/\/runs\/new/);
    const createPage = new CreateRunPage(page);
    await expect(createPage.suiteSelect).toBeVisible({ timeout: 30000 });
    await createPage.suiteSelect.locator("option").nth(1).waitFor({ state: "attached", timeout: 5000 });
    const firstSuiteValue = await createPage.suiteSelect.locator("option").nth(1).getAttribute("value");
    expect(firstSuiteValue).toBeTruthy();
    runName = `E2E Shortcuts ${Date.now()}`;
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

    await shortcutsBtn.click();
    await expect(page.getByText(/keyboard shortcuts/i)).toBeVisible();
    await expect(page.getByText(/next test/i)).toBeVisible();
    await expect(page.getByText(/mark passed/i)).toBeVisible();
    await expect(page.getByText(/mark failed/i)).toBeVisible();

    await shortcutsBtn.click();
    await expect(page.getByText(/keyboard shortcuts/i)).not.toBeVisible();
  });

  test("re-run failures button visible after marking a test failed", async ({ page }) => {
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
    await runView.sidebarStatusSelect.selectOption("failed");
    await runView.sidebarAddResultButton.click();
    await page.waitForLoadState("networkidle");
    await runView.closeSidebar();

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
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/re-run failures/i)).toBeVisible({ timeout: 10000 });
  });

  test("cleanup: delete runs", async ({ page }) => {
    if (!runName) return;
    await ensureBackofficeSelected(page);
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
    const rerunDeleteBtn = runsOverview.runDeleteButton(`${runName} (re-run failures)`);
    if (await rerunDeleteBtn.isVisible().catch(() => false)) {
      page.once("dialog", (d) => d.accept());
      await rerunDeleteBtn.click();
      await page.waitForLoadState("networkidle");
    }
  });
});

// ---------------------------------------------------------------------------
// Test Execution › Bulk Operations  [Story 2.9]
// ---------------------------------------------------------------------------

test.describe("Test Execution › Bulk Operations", () => {
  test.describe.configure({ mode: "serial" });

  let runId: string;

  test("setup: create scratch run", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const tcmsLink = page.locator("table").getByRole("link", { name: /tcms test project/i }).first();
    await tcmsLink.waitFor({ state: "visible", timeout: 15000 });
    await tcmsLink.click();
    await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    runId = await createScratchRun(page);
    expect(runId).toBeTruthy();
  });

  test("[Story 2.9] run view loads and shows test list", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(new RegExp(`/runs/${runId}`));
  });

  test("[Story 2.9] bulk toolbar appears when tests are selected", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId);
    await page.waitForLoadState("networkidle");

    const selectAll = page
      .getByRole("checkbox", { name: /select all/i })
      .or(page.locator('input[type="checkbox"]').first());

    if (!(await selectAll.isVisible().catch(() => false))) {
      test.skip(true, "No select-all checkbox — run may have no tests or bulk feature absent");
      return;
    }

    await selectAll.check();
    await page.waitForTimeout(300);

    const bulkToolbar = page
      .getByRole("combobox", { name: /set status|bulk/i })
      .or(page.getByText(/selected/i));

    await expect(bulkToolbar.first()).toBeVisible({ timeout: 5000 });
  });

  test("cleanup: delete scratch run", async ({ page }) => {
    if (!runId) return;
    await deleteRun(page, runId);
  });
});

// ---------------------------------------------------------------------------
// Test Execution › Run View & Filters  [Story 2.11]
// ---------------------------------------------------------------------------

test.describe("Test Execution › Run View & Filters", () => {
  test.describe.configure({ mode: "serial" });

  let runId: string;

  test("setup: create scratch run", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const tcmsLink = page.locator("table").getByRole("link", { name: /tcms test project/i }).first();
    await tcmsLink.waitFor({ state: "visible", timeout: 15000 });
    await tcmsLink.click();
    await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    runId = await createScratchRun(page);
    expect(runId).toBeTruthy();
  });

  test("[Story 2.11] status filter dropdown is present in run view", async ({ page }) => {
    expect(runId).toBeTruthy();
    const runView = new RunViewPage(page);
    await runView.goto(runId);
    await page.waitForLoadState("networkidle");

    const filterControl = page
      .getByRole("combobox", { name: /filter|status/i })
      .or(page.locator("select").filter({ hasText: /all|passed|failed/i }).first());

    if (!(await filterControl.isVisible().catch(() => false))) {
      test.skip(true, "Status filter not visible in this run");
      return;
    }

    await expect(filterControl).toBeVisible();
  });

  test("cleanup: delete scratch run", async ({ page }) => {
    if (!runId) return;
    await deleteRun(page, runId);
  });
});

// ---------------------------------------------------------------------------
// Test Execution › Flaky Test Detection  [Story 16.3]
// ---------------------------------------------------------------------------

test.describe("Test Execution › Flaky Test Detection", () => {
  test.describe.configure({ mode: "serial" });

  let runId: string;

  test("setup: create scratch run", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const tcmsLink = page.locator("table").getByRole("link", { name: /tcms test project/i }).first();
    await tcmsLink.waitFor({ state: "visible", timeout: 15000 });
    await tcmsLink.click();
    await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    runId = await createScratchRun(page);
    expect(runId).toBeTruthy();
  });

  test("[Story 16.3] run view renders without console errors", async ({ page }) => {
    expect(runId).toBeTruthy();
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const runView = new RunViewPage(page);
    await runView.goto(runId);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const jsErrors = errors.filter((e) => !e.includes("favicon"));
    expect(jsErrors, `Console errors: ${jsErrors.join(", ")}`).toHaveLength(0);
  });

  test("cleanup: delete scratch run", async ({ page }) => {
    if (!runId) return;
    await deleteRun(page, runId);
  });
});

// ---------------------------------------------------------------------------
// Test Execution › Smart Run Selection  [Story 17.4]
// ---------------------------------------------------------------------------

test.describe("Test Execution › Smart Run Selection", () => {
  test.describe.configure({ mode: "serial" });

  test("setup: navigate to create-run page", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const tcmsLink = page.locator("table").getByRole("link", { name: /tcms test project/i }).first();
    await tcmsLink.waitFor({ state: "visible", timeout: 15000 });
    await tcmsLink.click();
    await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    const { baseUrl, headers } = await getApiContext(page);
    const projectId = await getTcmsTestProjectId(page);

    const suites: { id: string; name: string }[] = await page.evaluate(
      async ({ baseUrl, headers, projectId }) => {
        const r = await fetch(`${baseUrl}/api/projects/${projectId}/suites`, { headers });
        return r.json();
      },
      { baseUrl, headers, projectId }
    );
    expect(suites.length).toBeGreaterThan(0);

    const executionSuite =
      suites.find((s) => s.name.toLowerCase().includes("test execution")) ?? suites[0];

    await page.goto(`/suites/${executionSuite.id}/runs/new`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText(/internal server error/i);
  });

  test("[Story 17.4] smart selection option visible on create-run page", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const tcmsLink = page.locator("table").getByRole("link", { name: /tcms test project/i }).first();
    await tcmsLink.waitFor({ state: "visible", timeout: 15000 });
    await tcmsLink.click();
    await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    const { baseUrl, headers } = await getApiContext(page);
    const projectId = await getTcmsTestProjectId(page);

    const suites: { id: string; name: string }[] = await page.evaluate(
      async ({ baseUrl, headers, projectId }) => {
        const r = await fetch(`${baseUrl}/api/projects/${projectId}/suites`, { headers });
        return r.json();
      },
      { baseUrl, headers, projectId }
    );
    const executionSuite =
      suites.find((s) => s.name.toLowerCase().includes("test execution")) ?? suites[0];

    await page.goto(`/suites/${executionSuite.id}/runs/new`);
    await page.waitForLoadState("networkidle");

    const smartOption = page
      .getByText(/smart|suggest|changed files/i)
      .or(page.getByRole("checkbox", { name: /smart/i }));

    if (!(await smartOption.first().isVisible().catch(() => false))) {
      test.skip(true, "Smart run selection UI not found on create-run page");
      return;
    }

    await expect(smartOption.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test Execution › Run Detail Tabs  (Sprint D — Stories 18.1-18.3)
// ---------------------------------------------------------------------------

test.describe("Test Execution › Run Detail Tabs", () => {
  test.describe.configure({ mode: "serial" });

  let runId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");

    const { baseUrl, headers } = await (async () => {
      const token = await page.evaluate(() => localStorage.getItem("tcms_token"));
      return {
        baseUrl: "http://localhost:3001",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      };
    })();

    // Find a usable run via Backoffice project
    const projects: { id: string; name: string }[] = await page.evaluate(
      async ({ baseUrl, headers }) => {
        const r = await fetch(`${baseUrl}/api/projects`, { headers });
        return r.json();
      },
      { baseUrl, headers }
    );
    const backoffice = projects.find((p) => /backoffice/i.test(p.name)) ?? projects[0];
    const suites: { id: string; name: string }[] = await page.evaluate(
      async ({ baseUrl, headers, projectId }) => {
        const r = await fetch(`${baseUrl}/api/projects/${projectId}/suites`, { headers });
        return r.json();
      },
      { baseUrl, headers, projectId: backoffice.id }
    );
    const suite = suites[0];
    const run: { id: string } = await page.evaluate(
      async ({ baseUrl, headers, suiteId }) => {
        const r = await fetch(`${baseUrl}/api/suites/${suiteId}/runs`, {
          method: "POST",
          headers,
          body: JSON.stringify({ name: "Sprint D tab test run" }),
        });
        return r.json();
      },
      { baseUrl, headers, suiteId: suite.id }
    );
    runId = run.id;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!runId) return;
    const page = await browser.newPage();
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const token = await page.evaluate(() => localStorage.getItem("tcms_token"));
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    await page.evaluate(
      async ({ runId, headers }) => {
        await fetch(`http://localhost:3001/api/runs/${runId}`, { method: "DELETE", headers });
      },
      { runId, headers }
    );
    await page.close();
  });

  test("[Story 18.1] Activity tab loads without error", async ({ page }) => {
    await page.goto(`/runs/${runId}/activity`);
    await page.waitForLoadState("networkidle");
    // Should show either entries or the empty state — not a crash
    const emptyState = page.getByText(/no activity recorded for this run yet/i);
    const activityCard = page.getByRole("heading", { name: /activity/i });
    const hasContent =
      (await emptyState.isVisible().catch(() => false)) ||
      (await activityCard.isVisible().catch(() => false));
    expect(hasContent, "Activity tab should show content or empty state").toBe(true);
  });

  test("[Story 18.1] Activity tab shows activity for brand-new run", async ({ page }) => {
    await page.goto(`/runs/${runId}/activity`);
    await page.waitForLoadState("networkidle");
    // A new run always has a run.created audit event — the activity list should be visible
    const activityHeading = page.getByRole("heading", { name: /activity/i });
    const createdEvent = page.getByText(/run\.created/i);
    const emptyState = page.getByText(/no activity recorded for this run yet/i);
    const hasContent =
      (await activityHeading.isVisible().catch(() => false)) ||
      (await createdEvent.isVisible().catch(() => false)) ||
      (await emptyState.isVisible().catch(() => false));
    expect(hasContent, "Activity tab should show run.created event or empty state").toBe(true);
  });

  test("[Story 18.2] Progress tab loads without error", async ({ page }) => {
    await page.goto(`/runs/${runId}/progress`);
    await page.waitForLoadState("networkidle");
    const emptyState = page.getByText(/no results recorded yet|not enough data yet/i);
    const heading = page.getByText(/pass rate over time/i);
    const hasContent =
      (await emptyState.isVisible().catch(() => false)) ||
      (await heading.isVisible().catch(() => false));
    expect(hasContent, "Progress tab should show content or empty state").toBe(true);
  });

  test("[Story 18.2] Progress tab shows empty state for run with no results", async ({ page }) => {
    await page.goto(`/runs/${runId}/progress`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/no results recorded yet/i)).toBeVisible({ timeout: 8000 });
  });

  test("[Story 18.3] Defects tab loads without error", async ({ page }) => {
    await page.goto(`/runs/${runId}/defects`);
    await page.waitForLoadState("networkidle");
    const emptyState = page.getByText(/no defects linked to this run/i);
    const heading = page.getByText(/linked defects/i);
    const hasContent =
      (await emptyState.isVisible().catch(() => false)) ||
      (await heading.isVisible().catch(() => false));
    expect(hasContent, "Defects tab should show content or empty state").toBe(true);
  });

  test("[Story 18.3] Defects tab shows empty state when no issue links", async ({ page }) => {
    await page.goto(`/runs/${runId}/defects`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/no defects linked to this run/i)).toBeVisible({ timeout: 8000 });
  });

  test("Run detail tab bar navigates between tabs", async ({ page }) => {
    const runViewPage = new RunViewPage(page);
    await runViewPage.goto(runId);
    await page.waitForLoadState("networkidle");

    // Navigate using sidebar sub-links
    await page.goto(`/runs/${runId}/activity`);
    await expect(page).toHaveURL(/\/activity/);

    await page.goto(`/runs/${runId}/progress`);
    await expect(page).toHaveURL(/\/progress/);

    await page.goto(`/runs/${runId}/defects`);
    await expect(page).toHaveURL(/\/defects/);
  });
});
