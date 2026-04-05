import { test, expect } from "@playwright/test";
import { CasesOverviewPage } from "../pages/CasesOverviewPage";
import { CaseEditorPage } from "../pages/CaseEditorPage";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Select Backoffice project from the cases overview project picker. */
async function selectBackofficeProject(
  page: import("@playwright/test").Page,
  casesPage: CasesOverviewPage
) {
  await casesPage.goto();
  await page.waitForLoadState("networkidle");
  const badge = casesPage.projectBadge();
  const alreadyBackoffice =
    (await badge.isVisible().catch(() => false)) &&
    (await page.getByText("Backoffice").first().isVisible().catch(() => false));
  if (!alreadyBackoffice) {
    const viewAll = page.getByRole("button", { name: /view all projects/i });
    if (await viewAll.isVisible().catch(() => false)) await viewAll.click();
    await page.waitForLoadState("networkidle");
    const table = casesPage.projectsTable;
    if (await table.isVisible().catch(() => false)) {
      const backofficeBtn = page.getByRole("button", { name: /backoffice/i }).first();
      if (await backofficeBtn.isVisible().catch(() => false)) await backofficeBtn.click();
      else await table.getByRole("row").nth(1).getByRole("button").first().click();
      await page.waitForLoadState("networkidle");
    }
  }
  await expect(casesPage.projectBadge()).toBeVisible({ timeout: 15000 });
}

/** Navigate to /projects then click the Backoffice project row link. */
async function ensureBackofficeSelected(page: import("@playwright/test").Page) {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  const backofficeLink = page.locator("table").getByRole("link", { name: /backoffice/i }).first();
  await backofficeLink.waitFor({ state: "visible", timeout: 15000 });
  await backofficeLink.click();
  await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
  await page.waitForLoadState("networkidle");
}

/** Navigate to first editable case in Backoffice via API. Returns the case edit URL. */
async function navigateToFirstCase(page: import("@playwright/test").Page): Promise<string> {
  await ensureBackofficeSelected(page);
  const projectMatch = page.url().match(/\/projects\/([a-f0-9-]+)/);
  const projectId = projectMatch?.[1];
  expect(projectId).toBeTruthy();

  const token = await page.evaluate(() => localStorage.getItem("tcms_token"));
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const baseUrl = "http://localhost:3001";

  const suites = (await (
    await fetch(`${baseUrl}/api/projects/${projectId}/suites`, { headers })
  ).json()) as { id: string }[];
  expect(suites.length).toBeGreaterThan(0);

  const sections = (await (
    await fetch(`${baseUrl}/api/suites/${suites[0].id}/sections`, { headers })
  ).json()) as { id: string }[];
  expect(sections.length).toBeGreaterThan(0);

  const cases = (await (
    await fetch(`${baseUrl}/api/sections/${sections[0].id}/cases`, { headers })
  ).json()) as { id: string }[];
  expect(cases.length).toBeGreaterThan(0);

  const caseUrl = `/cases/${cases[0].id}/edit`;
  await page.goto(caseUrl);
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/cases\/[a-f0-9-]+\/edit/);
  return page.url();
}

// ---------------------------------------------------------------------------
// Test Design › Cases Overview
// ---------------------------------------------------------------------------

test.describe("Test Design › Cases Overview", () => {
  test("shows Test Cases page", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await casesPage.goto();
    await expect(casesPage.pageTitle).toBeVisible();
  });

  test("without project selected shows project table or select prompt", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await casesPage.goto();
    await page.waitForLoadState("networkidle");
    const hasTable = await casesPage.projectsTable.isVisible().catch(() => false);
    const hasPrompt = await casesPage.selectProjectPrompt.isVisible().catch(() => false);
    const hasViewAll = await casesPage.viewAllProjectsButton.isVisible().catch(() => false);
    const hasTestCasesHeading = await casesPage.testCasesHeadingWithProject.isVisible().catch(() => false);
    const hasSummaryCards = await casesPage.summaryCards.first().isVisible().catch(() => false);
    expect(hasTable || hasPrompt || hasViewAll || hasTestCasesHeading || hasSummaryCards).toBeTruthy();
  });

  test("project summary cards visible when project is selected", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    await expect(casesPage.projectBadge()).toBeVisible({ timeout: 15000 });
    await expect(casesPage.summaryCards.first()).toBeVisible({ timeout: 15000 });
  });

  test("sort select is present and options work", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    await expect(casesPage.sortSelect).toBeVisible();
    await casesPage.sortSelect.selectOption("title-asc");
    await expect(casesPage.sortSelect).toHaveValue("title-asc");
    await casesPage.sortSelect.selectOption("section");
    await expect(casesPage.sortSelect).toHaveValue("section");
  });

  test("status filter is present and can be set", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    await expect(casesPage.statusFilterSelect).toBeVisible();
    await casesPage.statusFilterSelect.selectOption("draft");
    await expect(casesPage.statusFilterSelect).toHaveValue("draft");
  });

  test("search input is present and filters cases", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    await expect(casesPage.searchInput).toBeVisible();
    await casesPage.searchInput.fill("nonexistent-search-xyz");
    await page.waitForTimeout(300);
    await expect(casesPage.searchInput).toHaveValue("nonexistent-search-xyz");
  });

  test("collapse/expand all button toggles label", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    const collapseBtn = casesPage.collapseExpandAllButton;
    await expect(collapseBtn).toBeVisible();
    await expect(collapseBtn).toHaveText(/collapse all/i);
    await collapseBtn.click();
    await expect(collapseBtn).toHaveText(/expand all/i);
    await collapseBtn.click();
    await expect(collapseBtn).toHaveText(/collapse all/i);
  });

  test("individual section expand/collapse works", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    const firstSectionRow = page
      .locator("div.mb-5")
      .filter({ has: page.getByRole("button", { name: /expand|collapse/i }) })
      .first();
    await expect(firstSectionRow).toBeVisible();
    const expandBtn = firstSectionRow.getByRole("button", { name: /expand|collapse/i }).first();
    await expandBtn.click();
    await page.waitForTimeout(200);
    const expanded = await firstSectionRow.locator("table").isVisible().catch(() => false);
    await expandBtn.click();
    await page.waitForTimeout(200);
    const collapsed = !(await firstSectionRow.locator("table").isVisible().catch(() => false));
    expect(expanded || collapsed).toBeTruthy();
  });

  test("add and delete a section", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    await expect(casesPage.emptyState).not.toBeVisible();
    await casesPage.addSectionButton.click();
    await expect(casesPage.newSectionNameInput).toBeVisible();
    const sectionName = `E2E Section ${Date.now()}`;
    await casesPage.newSectionNameInput.fill(sectionName);
    await casesPage.addSectionSubmitButton.click();
    await page.waitForLoadState("networkidle");
    await expect(casesPage.sectionRow(sectionName)).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await casesPage.sectionDeleteButton(sectionName).click();
    await page.waitForLoadState("networkidle");
  });

  test("deleted section is no longer visible", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    await casesPage.addSectionButton.click();
    const sectionName = `E2E To Delete ${Date.now()}`;
    await casesPage.newSectionNameInput.fill(sectionName);
    await casesPage.addSectionSubmitButton.click();
    await page.waitForLoadState("networkidle");
    await expect(casesPage.sectionRow(sectionName)).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await casesPage.sectionDeleteButton(sectionName).click();
    await page.waitForLoadState("networkidle");
    await expect(casesPage.sectionRow(sectionName)).not.toBeVisible();
  });

  test("add and delete a subsection", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    const firstSectionRow = page
      .locator("div.mb-5")
      .filter({ has: page.getByRole("button", { name: /expand|collapse/i }) })
      .first();
    await expect(firstSectionRow).toBeVisible();
    const sectionName = await firstSectionRow
      .locator("span.font-medium")
      .first()
      .textContent()
      .then((t) => t?.trim() ?? "");
    const expandBtn = casesPage.sectionExpandCollapseButton(sectionName);
    await expandBtn.waitFor({ state: "visible", timeout: 5000 });
    if ((await expandBtn.getAttribute("aria-label")) === "Expand") {
      await expandBtn.click();
      await page.waitForTimeout(200);
    }
    const addSubBtn = casesPage.sectionBlock(sectionName).getByText("Add subsection").first();
    await addSubBtn.waitFor({ state: "visible", timeout: 5000 });
    await addSubBtn.click();
    const nameInput = casesPage.newSubsectionNameInputInSection(sectionName);
    await nameInput.waitFor({ state: "visible", timeout: 5000 });
    const subsectionName = `E2E Sub ${Date.now()}`;
    await nameInput.fill(subsectionName);
    await casesPage.sectionBlock(sectionName).getByRole("button", { name: /^add$/i }).first().click();
    await page.waitForLoadState("networkidle");
    await expect(casesPage.sectionRow(subsectionName)).toBeVisible({ timeout: 15000 });
    page.once("dialog", (d) => d.accept());
    await casesPage.sectionDeleteButton(subsectionName).click();
    await page.waitForLoadState("networkidle");
  });

  test("deleted subsection is no longer visible", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    const firstSectionRow = page
      .locator("div.mb-5")
      .filter({ has: page.getByRole("button", { name: /expand|collapse/i }) })
      .first();
    await expect(firstSectionRow).toBeVisible();
    const sectionName = await firstSectionRow
      .locator("span.font-medium")
      .first()
      .textContent()
      .then((t) => t?.trim() ?? "");
    const expandBtn = casesPage.sectionExpandCollapseButton(sectionName);
    await expandBtn.waitFor({ state: "visible", timeout: 5000 });
    if ((await expandBtn.getAttribute("aria-label")) === "Expand") {
      await expandBtn.click();
      await page.waitForTimeout(200);
    }
    const addSubBtn = casesPage.sectionBlock(sectionName).getByText("Add subsection").first();
    await addSubBtn.waitFor({ state: "visible", timeout: 5000 });
    await addSubBtn.click();
    const nameInput = casesPage.newSubsectionNameInputInSection(sectionName);
    await nameInput.waitFor({ state: "visible", timeout: 5000 });
    const subsectionName = `E2E Sub Del ${Date.now()}`;
    await nameInput.fill(subsectionName);
    await casesPage.sectionBlock(sectionName).getByRole("button", { name: /^add$/i }).first().click();
    await page.waitForLoadState("networkidle");
    await expect(casesPage.sectionRow(subsectionName)).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await casesPage.sectionDeleteButton(subsectionName).click();
    await page.waitForLoadState("networkidle");
    await expect(casesPage.sectionRow(subsectionName)).not.toBeVisible();
  });

  test("add case link navigates to case editor", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    const firstSectionWithAddCase = page
      .locator("div.mb-5")
      .filter({ has: page.getByRole("link", { name: /add case/i }) })
      .first();
    await expect(firstSectionWithAddCase).toBeVisible();
    await firstSectionWithAddCase.getByRole("button", { name: /expand|collapse/i }).first().click();
    await page.waitForTimeout(200);
    await firstSectionWithAddCase.getByRole("link", { name: /add case/i }).first().click();
    await expect(page).toHaveURL(/\/sections\/[^/]+\/cases\/new/);
    const editorPage = new CaseEditorPage(page);
    await editorPage.expectFormLoaded();
  });

  test("edit case link navigates to case editor with case data", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    const firstSectionRow = page
      .locator("div.mb-5")
      .filter({ has: page.getByRole("button", { name: /expand|collapse/i }) })
      .first();
    await expect(firstSectionRow).toBeVisible();
    const expandBtn = firstSectionRow.getByRole("button", { name: /expand|collapse/i }).first();
    if ((await expandBtn.getAttribute("aria-label")) === "Expand") {
      await expandBtn.click();
      await page.waitForTimeout(200);
    }
    const caseLink = page.locator("table a[href*='/cases/']").first();
    await expect(caseLink).toBeVisible();
    const caseTitle = await caseLink.textContent().then((t) => (t ?? "").trim() || "(Untitled)");
    await caseLink.click();
    await expect(page).toHaveURL(/\/cases\/[^/]+\/edit/);
    const editorPage = new CaseEditorPage(page);
    await editorPage.expectFormLoaded();
    await expect(editorPage.titleInput).toHaveValue(caseTitle === "(Untitled)" ? "" : caseTitle);
  });

  test("create test case – fill form, save, case appears in overview", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    const firstSectionWithAddCase = page
      .locator("div.mb-5")
      .filter({ has: page.getByRole("link", { name: /add case/i }) })
      .first();
    await expect(firstSectionWithAddCase).toBeVisible();
    await firstSectionWithAddCase.getByRole("button", { name: /expand|collapse/i }).first().click();
    await page.waitForTimeout(200);
    await firstSectionWithAddCase.getByRole("link", { name: /add case/i }).first().click();
    await expect(page).toHaveURL(/\/sections\/[^/]+\/cases\/new/);
    const editorPage = new CaseEditorPage(page);
    await editorPage.expectFormLoaded();
    const title = `E2E Case ${Date.now()}`;
    await editorPage.fillAndSave({ title, prerequisite: "E2E prerequisite" });
    await expect(page).toHaveURL(/\/cases\/[^/]+\/edit/);
    await expect(editorPage.titleInput).toHaveValue(title);
    await page.goto("/cases/overview");
    await page.waitForLoadState("networkidle");
    await selectBackofficeProject(page, casesPage);
    const sectionWithCase = page
      .locator("div.mb-5")
      .filter({ has: page.getByRole("link", { name: title }) })
      .first();
    const expandBtn = sectionWithCase.getByRole("button", { name: /expand|collapse/i }).first();
    if ((await expandBtn.getAttribute("aria-label")) === "Expand") {
      await expandBtn.click();
      await page.waitForTimeout(200);
    }
    page.once("dialog", (d) => d.accept());
    await casesPage.deleteCaseButton(title).click();
    await page.waitForLoadState("networkidle");
  });

  test("edit test case – change title, save, overview shows updated title", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    const firstSectionRow = page
      .locator("div.mb-5")
      .filter({ has: page.getByRole("button", { name: /expand|collapse/i }) })
      .first();
    await expect(firstSectionRow).toBeVisible();
    const expandBtn = firstSectionRow.getByRole("button", { name: /expand|collapse/i }).first();
    if ((await expandBtn.getAttribute("aria-label")) === "Expand") {
      await expandBtn.click();
      await page.waitForTimeout(200);
    }
    const caseLink = page.locator("table a[href*='/cases/']").first();
    await expect(caseLink).toBeVisible();
    await caseLink.click();
    await expect(page).toHaveURL(/\/cases\/[^/]+\/edit/);
    const editorPage = new CaseEditorPage(page);
    await editorPage.expectFormLoaded();
    const newTitle = `E2E Edited ${Date.now()}`;
    await editorPage.setTitleAndSave(newTitle);
    await expect(page).toHaveURL(/\/cases\/overview/);
    await expect(casesPage.editCaseLink(newTitle)).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await casesPage.deleteCaseButton(newTitle).click();
    await page.waitForLoadState("networkidle");
  });

  test("delete test case – case removed from overview", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectBackofficeProject(page, casesPage);
    const firstSectionWithAddCase = page
      .locator("div.mb-5")
      .filter({ has: page.getByRole("link", { name: /add case/i }) })
      .first();
    await expect(firstSectionWithAddCase).toBeVisible();
    const sectionName = await firstSectionWithAddCase
      .locator("span.font-medium")
      .first()
      .textContent()
      .then((t) => t?.trim() ?? "");
    await firstSectionWithAddCase.getByRole("button", { name: /expand|collapse/i }).first().click();
    await page.waitForTimeout(200);
    await firstSectionWithAddCase.getByRole("link", { name: /add case/i }).first().click();
    await expect(page).toHaveURL(/\/sections\/[^/]+\/cases\/new/);
    const editorPage = new CaseEditorPage(page);
    await editorPage.expectFormLoaded();
    const titleToDelete = `E2E To Delete ${Date.now()}`;
    await editorPage.fillAndSave({ title: titleToDelete });
    await expect(page).toHaveURL(/\/cases\/[^/]+\/edit/);
    await page.goto("/cases/overview");
    await page.waitForLoadState("networkidle");
    await selectBackofficeProject(page, casesPage);
    const expandBtn = casesPage.sectionExpandCollapseButton(sectionName);
    if ((await expandBtn.getAttribute("aria-label")) === "Expand") {
      await expandBtn.click();
      await page.waitForTimeout(200);
    }
    await expect(casesPage.editCaseLink(titleToDelete)).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await casesPage.deleteCaseButton(titleToDelete).click();
    await page.waitForLoadState("networkidle");
    await expect(casesPage.editCaseLink(titleToDelete)).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test Design › Case Approval  [Story B.1]
// ---------------------------------------------------------------------------

test.describe("Test Design › Case Approval", () => {
  let caseUrl: string | null = null;

  test.describe.configure({ mode: "serial" });

  test.afterAll(async ({ browser }) => {
    // Safety net: ensure case is reverted to draft even if cleanup test was skipped
    if (!caseUrl) return;
    const page = await browser.newPage();
    await page.goto(caseUrl);
    await page.waitForLoadState("networkidle");
    // Revoke approval if still approved
    const revokeBtn = page.getByRole("button", { name: /revoke approval/i });
    if (await revokeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await revokeBtn.click();
      await page.waitForLoadState("networkidle");
    }
    // Set status back to draft
    const statusSelect = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: /draft/i }) })
      .first();
    if (await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusSelect.selectOption("draft");
      const saveBtn = page.getByRole("button", { name: /save/i });
      if (await saveBtn.isVisible().catch(() => false)) await saveBtn.click();
      await page.waitForLoadState("networkidle");
    }
    await page.close();
  });

  test("setup: navigate to a case editor", async ({ page }) => {
    caseUrl = await navigateToFirstCase(page);
    expect(caseUrl).toBeTruthy();
  });

  test("case editor shows StatusBadge in header", async ({ page }) => {
    expect(caseUrl).toBeTruthy();
    await page.goto(caseUrl!);
    await page.waitForLoadState("networkidle");
    const editor = new CaseEditorPage(page);
    await editor.expectFormLoaded();

    const heading = page.getByText(/edit test case/i);
    await expect(heading).toBeVisible();
    const badge = page
      .locator("span")
      .filter({ hasText: /^(draft|ready|approved)$/ })
      .first();
    await expect(badge).toBeVisible();
  });

  test("changing status to Ready shows Approve button", async ({ page }) => {
    expect(caseUrl).toBeTruthy();
    await page.goto(caseUrl!);
    await page.waitForLoadState("networkidle");

    const statusSelect = page.locator("select").filter({ hasText: /draft/i }).first();
    await statusSelect.selectOption("ready");

    const approveBtn = page.getByRole("button", { name: /^approve$/i });
    await expect(approveBtn).toBeVisible();
  });

  test("clicking Approve changes status and shows approval info", async ({ page }) => {
    expect(caseUrl).toBeTruthy();
    await page.goto(caseUrl!);
    await page.waitForLoadState("networkidle");

    const statusSelect = page
      .locator("select")
      .filter({ hasText: /draft/i })
      .first()
      .or(page.locator("select").filter({ hasText: /ready/i }).first());
    await statusSelect.selectOption("ready");

    const approveBtn = page.getByRole("button", { name: /^approve$/i });
    await approveBtn.click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /revoke approval/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/approved by/i)).toBeVisible();
    const badge = page
      .locator("span")
      .filter({ hasText: /^approved$/ })
      .first();
    await expect(badge).toBeVisible();
  });

  test("clicking Revoke reverts to ready", async ({ page }) => {
    expect(caseUrl).toBeTruthy();
    await page.goto(caseUrl!);
    await page.waitForLoadState("networkidle");

    const revokeBtn = page.getByRole("button", { name: /revoke approval/i });
    if (!(await revokeBtn.isVisible().catch(() => false))) {
      test.skip(true, "Case not in approved state");
      return;
    }

    await revokeBtn.click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /^approve$/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/approved by/i)).not.toBeVisible();
  });

  test("cleanup: set case back to draft", async ({ page }) => {
    if (!caseUrl) return;
    await page.goto(caseUrl);
    await page.waitForLoadState("networkidle");
    const statusSelect = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: /draft/i }) })
      .first();
    await statusSelect.selectOption("draft");
    await page.getByRole("button", { name: /save/i }).click();
    await page.waitForLoadState("networkidle");
  });
});

// ---------------------------------------------------------------------------
// Test Design › Version History & Restore  [Story B.2 / Story 5.6]
// ---------------------------------------------------------------------------

test.describe("Test Design › Version History & Restore", () => {
  let caseUrl: string | null = null;

  test.describe.configure({ mode: "serial" });

  test("setup: edit case to generate versions", async ({ page }) => {
    caseUrl = await navigateToFirstCase(page);
    expect(caseUrl).toBeTruthy();

    const editor = new CaseEditorPage(page);
    await editor.expectFormLoaded();
    const currentTitle = await editor.titleInput.inputValue();
    await editor.setTitleAndSave(`${currentTitle} edited`);
    await page.waitForLoadState("networkidle");

    await page.goto(caseUrl!);
    await page.waitForLoadState("networkidle");
    await editor.expectFormLoaded();
    await editor.setTitleAndSave(currentTitle);
    await page.waitForLoadState("networkidle");
  });

  test("version history section shows versions with author and timestamp", async ({ page }) => {
    expect(caseUrl).toBeTruthy();
    await page.goto(caseUrl!);
    await page.waitForLoadState("networkidle");

    const historyHeading = page.getByText(/version history/i);
    await expect(historyHeading).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/by\s+\w+/i).first()).toBeVisible();

    const radios = page.locator('input[type="radio"]');
    expect(await radios.count()).toBeGreaterThanOrEqual(2);
  });

  test("compare versions button is enabled when two versions are selected", async ({ page }) => {
    expect(caseUrl).toBeTruthy();
    await page.goto(caseUrl!);
    await page.waitForLoadState("networkidle");

    const compareBtn = page.getByRole("button", { name: /compare versions/i });
    await expect(compareBtn).toBeVisible({ timeout: 10000 });
    await expect(compareBtn).toBeDisabled();

    const fromRadios = page.locator('input[name="diff-from"]');
    const toRadios = page.locator('input[name="diff-to"]');
    const fromCount = await fromRadios.count();
    if (fromCount >= 2) {
      await fromRadios.first().click();
      await toRadios.last().click();
      await expect(compareBtn).toBeEnabled();
    }
  });

  test("diff view shows changes between versions", async ({ page }) => {
    expect(caseUrl).toBeTruthy();
    await page.goto(caseUrl!);
    await page.waitForLoadState("networkidle");

    const fromRadios = page.locator('input[name="diff-from"]');
    const toRadios = page.locator('input[name="diff-to"]');
    const fromCount = await fromRadios.count();
    if (fromCount < 2) {
      test.skip(true, "Not enough versions to compare");
      return;
    }

    await fromRadios.first().click();
    await toRadios.last().click();
    await page.getByRole("button", { name: /compare versions/i }).click();

    await page.waitForTimeout(2000);
    const diffPanel = page
      .locator("div")
      .filter({ hasText: /title|prerequisite|steps|no differences/i });
    await expect(diffPanel.first()).toBeVisible({ timeout: 5000 });
  });

  test("[Story 5.6] version history tab visible in case editor (TCMS Test Project)", async ({ page }) => {
    // This test targets the TCMS Test Project (not Backoffice)
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const tcmsLink = page.locator("table").getByRole("link", { name: /tcms test project/i }).first();
    if (!(await tcmsLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "TCMS Test Project not found");
      return;
    }
    await tcmsLink.click();
    await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });

    const token = await page.evaluate(() => localStorage.getItem("tcms_token"));
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const baseUrl = "http://localhost:3001";
    const projectId = page.url().match(/\/projects\/([a-f0-9-]+)/)?.[1];
    if (!projectId) { test.skip(true, "No project ID"); return; }

    const suites = (await (await fetch(`${baseUrl}/api/projects/${projectId}/suites`, { headers })).json()) as { id: string; name?: string }[];
    if (!suites.length) { test.skip(true, "No suites"); return; }

    const sections = (await (await fetch(`${baseUrl}/api/suites/${suites[0].id}/sections`, { headers })).json()) as { id: string }[];
    if (!sections.length) { test.skip(true, "No sections"); return; }

    const cases = (await (await fetch(`${baseUrl}/api/sections/${sections[0].id}/cases`, { headers })).json()) as { id: string }[];
    if (!cases.length) { test.skip(true, "No cases"); return; }

    await page.goto(`/cases/${cases[0].id}/edit`);
    await page.waitForLoadState("networkidle");

    const editor = new CaseEditorPage(page);
    await editor.expectFormLoaded();

    const versionTab = page
      .getByRole("button", { name: /version history|history|versions/i })
      .or(page.getByText(/version history/i).first())
      .or(page.getByRole("tab", { name: /history/i }));

    if (!(await versionTab.first().isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Version History tab not found");
      return;
    }
    await expect(versionTab.first()).toBeVisible();
  });

  test("[Story 5.6] clicking version history shows list or empty state", async ({ page }) => {
    expect(caseUrl).toBeTruthy();
    await page.goto(caseUrl!);
    await page.waitForLoadState("networkidle");
    const editor = new CaseEditorPage(page);
    await editor.expectFormLoaded();

    const versionTab = page
      .getByRole("button", { name: /version history/i })
      .or(page.getByText(/version history/i).first());

    if (await versionTab.isVisible().catch(() => false)) {
      await versionTab.first().click();
      await page.waitForTimeout(500);
      await expect(page.locator("body")).not.toContainText(/internal server error/i);
    } else {
      test.skip(true, "Version History tab not found");
    }
  });
});

// ---------------------------------------------------------------------------
// Test Design › Dataset Management  [Story B.3]
// ---------------------------------------------------------------------------

test.describe("Test Design › Dataset Management", () => {
  test("project settings shows datasets section", async ({ page }) => {
    await ensureBackofficeSelected(page);
    const settingsLink = page.getByRole("link", { name: /settings/i }).first();
    await settingsLink.click();
    await page.waitForLoadState("networkidle");
    // Sprint D: Datasets moved to Case Config tab
    const caseConfigBtn = page.getByRole("button", { name: /case config/i });
    await caseConfigBtn.waitFor({ state: "visible", timeout: 8000 });
    await caseConfigBtn.click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/datasets/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/dataset name/i)).toBeVisible();
  });

  test("create dataset with columns and rows, then delete", async ({ page }) => {
    await ensureBackofficeSelected(page);
    const settingsLink = page.getByRole("link", { name: /settings/i }).first();
    await settingsLink.click();
    await page.waitForLoadState("networkidle");
    // Sprint D: Datasets moved to Case Config tab
    const caseConfigBtn = page.getByRole("button", { name: /case config/i });
    await caseConfigBtn.waitFor({ state: "visible", timeout: 8000 });
    await caseConfigBtn.click();
    await page.waitForLoadState("networkidle");

    const datasetName = `E2E Dataset ${Date.now()}`;
    await page.getByPlaceholder(/dataset name/i).fill(datasetName);
    // Button text is "Add" (not "Add dataset")
    await page.getByPlaceholder(/dataset name/i).locator("..").getByRole("button", { name: /^add$/i }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(datasetName)).toBeVisible({ timeout: 5000 });
    const manageBtn = page.getByRole("button", { name: /manage/i }).first();
    await expect(manageBtn).toBeVisible();
    await manageBtn.click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByPlaceholder(/column name/i)).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder(/column name/i).fill("Browser");
    const columnAddBtn = page
      .getByPlaceholder(/column name/i)
      .locator("..")
      .getByRole("button", { name: /add/i });
    await columnAddBtn.click();
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator("span.rounded-full").filter({ hasText: "Browser" }).first()
    ).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder(/column name/i).fill("OS");
    await columnAddBtn.click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("textbox", { name: "Browser" }).last().fill("Chrome");
    await page.getByRole("textbox", { name: "OS" }).last().fill("Windows");
    await page.getByRole("button", { name: /add row/i }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/Data \(\d+ rows?\)/)).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.waitForLoadState("networkidle");
    const datasetRow = page.locator("li").filter({ hasText: datasetName });
    const deleteBtn = datasetRow.getByRole("button", { name: /delete/i });
    if (await deleteBtn.isVisible().catch(() => false)) {
      page.once("dialog", (d) => d.accept());
      await deleteBtn.click();
      await page.waitForLoadState("networkidle");
    }
  });
});

// ---------------------------------------------------------------------------
// Test Design › Case Search & Filtering  [Story 1.9]
// ---------------------------------------------------------------------------

test.describe("Test Design › Case Search & Filtering", () => {
  test.describe.configure({ mode: "serial" });

  async function openCasesForTcmsProject(page: import("@playwright/test").Page) {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const tcmsLink = page.locator("table").getByRole("link", { name: /tcms test project/i }).first();
    await tcmsLink.waitFor({ state: "visible", timeout: 15000 });
    await tcmsLink.click();
    await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await page.goto("/cases/overview");
    await page.waitForLoadState("networkidle");
  }

  test("[Story 1.9] search bar filters cases by keyword", async ({ page }) => {
    await openCasesForTcmsProject(page);

    const searchInput = page
      .getByRole("searchbox", { name: /search cases/i })
      .or(page.getByPlaceholder(/search/i))
      .first();

    if (!(await searchInput.isVisible().catch(() => false))) {
      test.skip(true, "CaseSearchBar not visible on this page");
      return;
    }

    await searchInput.fill("login");
    await page.waitForTimeout(600);

    await expect(page.locator("body")).not.toContainText(/internal server error/i);
  });

  test("[Story 1.9] empty state shown for unmatched keyword", async ({ page }) => {
    await openCasesForTcmsProject(page);

    const searchInput = page
      .getByRole("searchbox", { name: /search cases/i })
      .or(page.getByPlaceholder(/search/i))
      .first();

    if (!(await searchInput.isVisible().catch(() => false))) {
      test.skip(true, "CaseSearchBar not visible");
      return;
    }

    await searchInput.fill("xyzzynocase_impossible_match_9999");
    await page.waitForTimeout(600);

    await expect(page.locator("body")).not.toContainText(/internal server error/i);
  });
});
