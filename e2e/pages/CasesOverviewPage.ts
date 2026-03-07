import { type Page } from "@playwright/test";
import { BasePage } from "./base";

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

  get pageTitle() {
    return this.page.getByRole("heading", { name: /test cases/i });
  }

  get viewAllProjectsButton() {
    return this.page.getByRole("button", { name: /view all projects/i });
  }

  get selectProjectPrompt() {
    return this.page.getByText(/select a project to view and manage test cases/i);
  }

  get testCasesHeadingWithProject() {
    return this.page.getByRole("heading", { name: /test cases/i });
  }

  get projectsTable() {
    return this.page.getByRole("table");
  }

  get summaryCards() {
    return this.page.getByText(/total cases|draft|ready|approved/i);
  }

  get sortSelect() {
    return this.page.locator("select").filter({ has: this.page.locator('option[value="section"]') });
  }

  get statusFilterSelect() {
    return this.page.locator("select").filter({ has: this.page.locator('option[value="draft"]') });
  }

  get searchInput() {
    return this.page.getByRole("searchbox", { name: /search cases/i }).or(this.page.getByPlaceholder(/title or prerequisite/i));
  }

  get collapseExpandAllButton() {
    return this.page.getByRole("button", { name: /collapse all|expand all/i });
  }

  get manageSectionsLink() {
    return this.page.getByRole("link", { name: /manage sections/i });
  }

  get addSectionButton() {
    return this.page.getByRole("button", { name: /\+ add section/i });
  }

  get newSectionNameInput() {
    return this.page.getByPlaceholder(/new section name/i);
  }

  get addSectionSubmitButton() {
    return this.page.locator("form").filter({ has: this.newSectionNameInput }).getByRole("button", { name: /^add$/i });
  }

  get addSectionCancelButton() {
    return this.page.locator("form").filter({ has: this.newSectionNameInput }).getByRole("button", { name: /cancel/i });
  }

  get emptyState() {
    return this.page.getByText(/no test suite yet|no projects yet/i);
  }

  /** Select a project from the project table (when no project is selected). */
  async selectProjectInTable(projectName: string) {
    await this.page.getByRole("button", { name: new RegExp(projectName, "i") }).first().click();
  }

  /** Project badge showing current project name. */
  projectBadge(name?: string) {
    if (name) return this.page.getByText(name, { exact: false }).filter({ has: this.page.locator("span") }).first();
    return this.page.locator("span.rounded-md.bg-slate-100").first();
  }

  /** Section header row containing the section name (with expand/collapse, edit, delete). */
  sectionRow(sectionName: string) {
    return this.page.locator("div.rounded-lg.border").filter({ has: this.page.getByText(sectionName, { exact: true }) }).first();
  }

  /** Full section block (div.mb-5) that contains header and expanded content (Add case, Add subsection). */
  sectionBlock(sectionName: string) {
    return this.page.locator("div.mb-5").filter({ has: this.page.getByText(sectionName, { exact: true }) }).first();
  }

  /** Expand/collapse button for a section (aria-label Expand or Collapse). */
  sectionExpandCollapseButton(sectionName: string) {
    return this.sectionRow(sectionName).getByRole("button", { name: /expand|collapse/i }).first();
  }

  /** Delete section button (trash icon). */
  sectionDeleteButton(sectionName: string) {
    return this.sectionRow(sectionName).getByRole("button", { name: /delete section/i });
  }

  /** "Add case" link under a section (section must be expanded). */
  addCaseLinkInSection(sectionName: string) {
    return this.sectionBlock(sectionName).getByRole("link", { name: /add case/i });
  }

  /** "Add subsection" button under a section (section must be expanded). */
  addSubsectionButtonInSection(sectionName: string) {
    return this.sectionBlock(sectionName).getByRole("button", { name: /add subsection/i });
  }

  /** Subsection form input (when "Add subsection" form is visible under a section). */
  get newSubsectionNameInput() {
    return this.page.getByPlaceholder("Name");
  }

  /** Subsection form input scoped to a section block (use after clicking "Add subsection" in that section). */
  newSubsectionNameInputInSection(sectionName: string) {
    return this.sectionBlock(sectionName).getByPlaceholder("Name");
  }

  get addSubsectionSubmitButton() {
    return this.page.locator("form").filter({ has: this.page.getByPlaceholder("Name") }).getByRole("button", { name: /^add$/i });
  }

  /** Edit link for a case by case title (in the cases table). */
  editCaseLink(caseTitle: string) {
    return this.page.getByRole("link", { name: new RegExp(caseTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
  }

  /** Delete button for a case row by case title. */
  deleteCaseButton(caseTitle: string) {
    const escaped = caseTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return this.page
      .getByRole("row")
      .filter({ has: this.page.getByRole("link", { name: new RegExp(escaped, "i") }) })
      .getByRole("button", { name: /delete/i });
  }
}
