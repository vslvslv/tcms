import { test, expect } from "@playwright/test";
import { CaseEditorPage } from "../pages/CaseEditorPage";

async function ensureProjectSelected(page: import("@playwright/test").Page) {
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  const backofficeLink = page.getByRole("link", { name: /backoffice/i }).first();
  await backofficeLink.waitFor({ state: "visible", timeout: 15000 });
  await backofficeLink.click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);
  await page.waitForLoadState("networkidle");
}

/** Navigate to the first editable case in the Backoffice project via API. */
async function navigateToFirstCase(page: import("@playwright/test").Page): Promise<string> {
  await ensureProjectSelected(page);
  const projectMatch = page.url().match(/\/projects\/([a-f0-9-]+)/);
  const projectId = projectMatch?.[1];
  expect(projectId).toBeTruthy();

  // Use the API to find suites -> sections -> cases
  const token = await page.evaluate(() => localStorage.getItem("tcms_token"));
  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  const baseUrl = "http://localhost:3001";

  const suites = await (await fetch(`${baseUrl}/api/projects/${projectId}/suites`, { headers })).json() as { id: string }[];
  expect(suites.length).toBeGreaterThan(0);

  const sections = await (await fetch(`${baseUrl}/api/suites/${suites[0].id}/sections`, { headers })).json() as { id: string }[];
  expect(sections.length).toBeGreaterThan(0);

  const cases = await (await fetch(`${baseUrl}/api/sections/${sections[0].id}/cases`, { headers })).json() as { id: string }[];
  expect(cases.length).toBeGreaterThan(0);

  const caseUrl = `/cases/${cases[0].id}/edit`;
  await page.goto(caseUrl);
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/cases\/[a-f0-9-]+\/edit/);
  return page.url();
}

test.describe("Sprint B — Case Approval", () => {
  let caseUrl: string | null = null;

  test.describe.configure({ mode: "serial" });

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
    const badge = page.locator("span").filter({ hasText: /^(draft|ready|approved)$/ }).first();
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

    // Set to Ready first
    const statusSelect = page.locator("select").filter({ hasText: /draft/i }).first()
      .or(page.locator("select").filter({ hasText: /ready/i }).first());
    await statusSelect.selectOption("ready");

    const approveBtn = page.getByRole("button", { name: /^approve$/i });
    await approveBtn.click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /revoke approval/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/approved by/i)).toBeVisible();
    const badge = page.locator("span").filter({ hasText: /^approved$/ }).first();
    await expect(badge).toBeVisible();
  });

  test("clicking Revoke reverts to ready", async ({ page }) => {
    expect(caseUrl).toBeTruthy();
    await page.goto(caseUrl!);
    await page.waitForLoadState("networkidle");

    const revokeBtn = page.getByRole("button", { name: /revoke approval/i });
    if (!(await revokeBtn.isVisible().catch(() => false))) {
      test.skip();
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
    const statusSelect = page.locator("select").filter({ has: page.locator("option", { hasText: /draft/i }) }).first();
    await statusSelect.selectOption("draft");
    await page.getByRole("button", { name: /save/i }).click();
    await page.waitForLoadState("networkidle");
  });
});

test.describe("Sprint B — Version History", () => {
  let caseUrl: string | null = null;

  test.describe.configure({ mode: "serial" });

  test("setup: navigate to case and edit to generate versions", async ({ page }) => {
    caseUrl = await navigateToFirstCase(page);
    expect(caseUrl).toBeTruthy();

    // Edit the title to create a new version
    const editor = new CaseEditorPage(page);
    await editor.expectFormLoaded();
    const currentTitle = await editor.titleInput.inputValue();
    await editor.setTitleAndSave(`${currentTitle} edited`);
    await page.waitForLoadState("networkidle");

    // Edit back to original
    await page.goto(caseUrl);
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

  test("compare versions button works when two versions selected", async ({ page }) => {
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
      test.skip();
      return;
    }

    await fromRadios.first().click();
    await toRadios.last().click();
    await page.getByRole("button", { name: /compare versions/i }).click();

    // Wait for diff to load — either shows change details or "no differences"
    await page.waitForTimeout(2000);
    // The diff panel should now be visible with some content
    const diffPanel = page.locator("div").filter({ hasText: /title|prerequisite|steps|no differences/i });
    await expect(diffPanel.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Sprint B — Dataset Management", () => {
  test("project settings shows dataset section", async ({ page }) => {
    await ensureProjectSelected(page);
    // Click Settings link in project page
    const settingsLink = page.getByRole("link", { name: /settings/i }).first();
    await settingsLink.click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/datasets/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/dataset name/i)).toBeVisible();
  });

  test("create dataset, add columns and rows", async ({ page }) => {
    await ensureProjectSelected(page);
    const settingsLink = page.getByRole("link", { name: /settings/i }).first();
    await settingsLink.click();
    await page.waitForLoadState("networkidle");

    // Create a dataset
    const datasetName = `E2E Dataset ${Date.now()}`;
    await page.getByPlaceholder(/dataset name/i).fill(datasetName);
    // Click the Add dataset button specifically (not other Add buttons)
    await page.getByRole("button", { name: /add dataset/i }).click();
    await page.waitForLoadState("networkidle");

    // Should see the dataset with Manage button
    await expect(page.getByText(datasetName)).toBeVisible({ timeout: 5000 });
    const manageBtn = page.getByRole("button", { name: /manage/i }).first();
    await expect(manageBtn).toBeVisible();

    // Click Manage to expand DatasetEditor
    await manageBtn.click();
    await page.waitForLoadState("networkidle");

    // Should see Columns section and column name input
    await expect(page.getByPlaceholder(/column name/i)).toBeVisible({ timeout: 5000 });

    // Add a column — use the Add button near the column name input
    await page.getByPlaceholder(/column name/i).fill("Browser");
    // The Add button is inside the DatasetEditor column form
    const columnAddBtn = page.getByPlaceholder(/column name/i).locator("..").getByRole("button", { name: /add/i });
    await columnAddBtn.click();
    await page.waitForLoadState("networkidle");

    // Column pill should appear
    await expect(page.locator("span.rounded-full").filter({ hasText: "Browser" }).first()).toBeVisible({ timeout: 5000 });

    // Add another column
    await page.getByPlaceholder(/column name/i).fill("OS");
    await columnAddBtn.click();
    await page.waitForLoadState("networkidle");

    // Add a row — use getByRole to target inputs near the Add row button
    await page.getByRole("textbox", { name: "Browser" }).last().fill("Chrome");
    await page.getByRole("textbox", { name: "OS" }).last().fill("Windows");
    await page.getByRole("button", { name: /add row/i }).click();
    await page.waitForLoadState("networkidle");

    // Row should appear — the Data heading shows row count
    await expect(page.getByText(/Data \(\d+ rows?\)/)).toBeVisible({ timeout: 5000 });

    // Go back and delete the dataset
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.waitForLoadState("networkidle");
    // Find the delete button near our dataset name
    const datasetRow = page.locator("li").filter({ hasText: datasetName });
    const deleteBtn = datasetRow.getByRole("button", { name: /delete/i });
    if (await deleteBtn.isVisible().catch(() => false)) {
      page.once("dialog", (d) => d.accept());
      await deleteBtn.click();
      await page.waitForLoadState("networkidle");
    }
  });
});
