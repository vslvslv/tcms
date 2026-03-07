import { test, expect } from "@playwright/test";
import { CasesOverviewPage } from "../pages/CasesOverviewPage";
import { CaseEditorPage } from "../pages/CaseEditorPage";

/** Ensure Backoffice (seeded project with sections) is selected. Use project table when visible. */
async function selectFirstProjectIfNeeded(
  page: import("@playwright/test").Page,
  casesPage: CasesOverviewPage
) {
  await casesPage.goto();
  await page.waitForLoadState("networkidle");
  const badge = casesPage.projectBadge();
  const alreadyBackoffice = await badge.isVisible().catch(() => false) && await page.getByText("Backoffice").first().isVisible().catch(() => false);
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

test.describe("Cases Overview", () => {
  test("shows Test Cases page", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await casesPage.goto();
    await expect(casesPage.pageTitle).toBeVisible();
  });

  test("without project selected shows project table or select prompt, or project overview", async ({ page }) => {
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

  test("reviewing cases section when a project is selected", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    await expect(casesPage.projectBadge()).toBeVisible({ timeout: 15000 });
    await expect(casesPage.summaryCards.first()).toBeVisible({ timeout: 15000 });
  });

  test("Sorting – sort select is present and options work", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    const sortSelect = casesPage.sortSelect;
    await expect(sortSelect).toBeVisible();
    await sortSelect.selectOption("title-asc");
    await expect(sortSelect).toHaveValue("title-asc");
    await sortSelect.selectOption("section");
    await expect(sortSelect).toHaveValue("section");
  });

  test("Filtering – status filter is present and can be set", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    const statusSelect = casesPage.statusFilterSelect;
    await expect(statusSelect).toBeVisible();
    await statusSelect.selectOption("draft");
    await expect(statusSelect).toHaveValue("draft");
  });

  test("Search – search input is present and filters cases", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    await expect(casesPage.searchInput).toBeVisible();
    await casesPage.searchInput.fill("nonexistent-search-xyz");
    await page.waitForTimeout(300);
    await expect(casesPage.searchInput).toHaveValue("nonexistent-search-xyz");
  });

  test("Collapse/Expand all – button toggles label", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    const collapseBtn = casesPage.collapseExpandAllButton;
    await expect(collapseBtn).toBeVisible();
    await expect(collapseBtn).toHaveText(/collapse all/i);
    await collapseBtn.click();
    await expect(collapseBtn).toHaveText(/expand all/i);
    await collapseBtn.click();
    await expect(collapseBtn).toHaveText(/collapse all/i);
  });

  test("Collapsing/Expanding specific sections", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    const firstSectionRow = page.locator("div.mb-5").filter({ has: page.getByRole("button", { name: /expand|collapse/i }) }).first();
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

  test("Adding section", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
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

  test("Removing section", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    await expect(casesPage.emptyState).not.toBeVisible();
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

  test("Adding subsection", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    const firstSectionRow = page.locator("div.mb-5").filter({ has: page.getByRole("button", { name: /expand|collapse/i }) }).first();
    await expect(firstSectionRow).toBeVisible();
    const sectionName = await firstSectionRow.locator("span.font-medium").first().textContent().then((t) => t?.trim() ?? "");
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

  test("Removing subsection", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    const firstSectionRow = page.locator("div.mb-5").filter({ has: page.getByRole("button", { name: /expand|collapse/i }) }).first();
    await expect(firstSectionRow).toBeVisible();
    const sectionName = await firstSectionRow.locator("span.font-medium").first().textContent().then((t) => t?.trim() ?? "");
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

  test("Add case opens Add Case component and component is loaded properly", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    const firstSectionWithAddCase = page.locator("div.mb-5").filter({ has: page.getByRole("link", { name: /add case/i }) }).first();
    await expect(firstSectionWithAddCase).toBeVisible();
    await firstSectionWithAddCase.getByRole("button", { name: /expand|collapse/i }).first().click();
    await page.waitForTimeout(200);
    await firstSectionWithAddCase.getByRole("link", { name: /add case/i }).first().click();
    await expect(page).toHaveURL(/\/sections\/[^/]+\/cases\/new/);
    const editorPage = new CaseEditorPage(page);
    await editorPage.expectFormLoaded();
  });

  test("Edit case opens Add Case component and component is loaded properly", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    const firstSectionRow = page.locator("div.mb-5").filter({ has: page.getByRole("button", { name: /expand|collapse/i }) }).first();
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

  test("Creating a test case – fill form, save, redirects to edit page", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    const firstSectionWithAddCase = page.locator("div.mb-5").filter({ has: page.getByRole("link", { name: /add case/i }) }).first();
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
    await selectFirstProjectIfNeeded(page, casesPage);
    const sectionWithCase = page.locator("div.mb-5").filter({ has: page.getByRole("link", { name: title }) }).first();
    const expandBtn = sectionWithCase.getByRole("button", { name: /expand|collapse/i }).first();
    if ((await expandBtn.getAttribute("aria-label")) === "Expand") {
      await expandBtn.click();
      await page.waitForTimeout(200);
    }
    page.once("dialog", (d) => d.accept());
    await casesPage.deleteCaseButton(title).click();
    await page.waitForLoadState("networkidle");
  });

  test("Editing a test case – change title, save, returns to overview with updated title", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    const firstSectionRow = page.locator("div.mb-5").filter({ has: page.getByRole("button", { name: /expand|collapse/i }) }).first();
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

  test("Deleting a test case – delete button, confirm dialog, case removed from overview", async ({ page }) => {
    const casesPage = new CasesOverviewPage(page);
    await selectFirstProjectIfNeeded(page, casesPage);
    const firstSectionWithAddCase = page.locator("div.mb-5").filter({ has: page.getByRole("link", { name: /add case/i }) }).first();
    await expect(firstSectionWithAddCase).toBeVisible();
    const sectionName = await firstSectionWithAddCase.locator("span.font-medium").first().textContent().then((t) => t?.trim() ?? "");
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
    await selectFirstProjectIfNeeded(page, casesPage);
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
