import { type Page, type Locator } from "@playwright/test";
import { BasePage } from "./base";

/**
 * Page Object for CasesOverview — three-panel master-detail layout (Story X.1).
 *
 * DOM structure:
 *   [data-testid="section-tree"]        — left panel: suite + section tree
 *   [data-testid="section-node-{id}"]   — individual tree node (role=button)
 *   [data-testid="case-row-{id}"]       — case table row (role=button)
 *   [data-testid="detail-panel"]        — right slide-in panel
 */
export class CasesOverviewPage extends BasePage {
  static readonly path = "/cases/overview";

  constructor(page: Page) {
    super(page);
  }

  async goto(options?: { timeout?: number; waitUntil?: "load" | "domcontentloaded" | "commit" }) {
    await this.page.goto(CasesOverviewPage.path, {
      waitUntil: options?.waitUntil ?? "domcontentloaded",
      timeout: options?.timeout,
    });
  }

  // ── Project-list view (no project selected) ────────────────────────────────

  get selectProjectPrompt() {
    return this.page.getByText(/select a project to view and manage test cases/i);
  }

  get projectsTable() {
    return this.page.getByRole("table");
  }

  /** Click a project name in the project list to open the three-panel view. */
  async selectProjectInTable(projectName: string) {
    await this.page.getByRole("button", { name: new RegExp(projectName, "i") }).first().click();
  }

  // ── Left panel: section tree ───────────────────────────────────────────────

  get sectionTree(): Locator {
    return this.page.getByTestId("section-tree");
  }

  /** Back-to-all-projects button in tree header. */
  get viewAllProjectsButton(): Locator {
    return this.page.getByTitle("View all projects");
  }

  /** Section tree node by its data-testid (data-testid="section-node-{id}"). */
  sectionNode(id: string): Locator {
    return this.page.getByTestId(`section-node-${id}`);
  }

  /** Section tree node by visible text. Falls back to text match when id is unknown. */
  sectionNodeByName(name: string): Locator {
    return this.sectionTree.getByRole("button", { name: new RegExp(name, "i") }).first();
  }

  /** Click a section in the tree. */
  async selectSection(id: string) {
    await this.sectionNode(id).click();
  }

  // ── Center panel: case table ───────────────────────────────────────────────

  /** Case table row by data-testid (data-testid="case-row-{id}"). */
  caseRow(id: string): Locator {
    return this.page.getByTestId(`case-row-${id}`);
  }

  /** Case table row by visible title text. */
  caseRowByTitle(title: string): Locator {
    return this.page.getByRole("button", { name: new RegExp(`Case: ${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i") });
  }

  /** Click a case row to open the detail panel. */
  async openCase(id: string) {
    await this.caseRow(id).click();
  }

  get searchInput(): Locator {
    return this.page.getByPlaceholder(/search test cases/i);
  }

  get priorityFilterSelect(): Locator {
    return this.page.locator("select").filter({ has: this.page.locator('option[value=""]') }).nth(0);
  }

  get statusFilterSelect(): Locator {
    return this.page.locator("select").filter({ has: this.page.locator('option[value="draft"]') }).first();
  }

  get sortSelect(): Locator {
    return this.page.locator("select").filter({ has: this.page.locator('option[value="section"]') });
  }

  get clearFiltersButton(): Locator {
    return this.page.getByRole("button", { name: /clear filters/i });
  }

  get emptyState(): Locator {
    return this.page.getByText(/no test suite yet|no sections|no cases in this section/i);
  }

  // ── Right panel: case detail ───────────────────────────────────────────────

  get detailPanel(): Locator {
    return this.page.getByTestId("detail-panel");
  }

  get detailPanelCloseButton(): Locator {
    return this.detailPanel.getByRole("button", { name: /close panel/i });
  }

  async closeDetailPanel() {
    await this.detailPanelCloseButton.click();
  }

  /** Check if the detail panel is currently visible (translated into view). */
  async isDetailPanelOpen(): Promise<boolean> {
    const cls = await this.detailPanel.getAttribute("class");
    return cls?.includes("translate-x-0") ?? false;
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────

  get bulkActionBar(): Locator {
    return this.page.getByText(/\d+ selected/);
  }

  selectCaseCheckbox(caseId: string): Locator {
    return this.caseRow(caseId).getByRole("checkbox");
  }

  // ── Section management ─────────────────────────────────────────────────────

  addSectionButton(suiteId: string): Locator {
    return this.sectionTree.getByTestId(`add-section-${suiteId}`);
  }

  get newSectionNameInput(): Locator {
    return this.page.getByPlaceholder("Section name").last();
  }
}
