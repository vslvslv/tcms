import { type Page } from "@playwright/test";
import { BasePage } from "./base";

export class RunViewPage extends BasePage {
  static readonly pathPattern = /\/runs\/[^/]+/;

  constructor(page: Page) {
    super(page);
  }

  async goto(runId: string) {
    await this.page.goto(`/runs/${runId}`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  get runTitle() {
    return this.page.locator("h1, h2").first();
  }

  get testStatusHeading() {
    return this.page.getByText(/test status/i);
  }

  get testsTable() {
    return this.page.getByRole("table");
  }

  get noTestsMessage() {
    return this.page.getByText(/no tests in this run/i);
  }

  get sortSelect() {
    return this.page.locator("select").filter({ hasText: /sort/i });
  }

  /** First clickable test row in the run (rows have role="button" in the app). */
  get firstTestRow() {
    return this.page.getByRole("table").first().getByRole("button").first();
  }

  /** Sidebar container (visible when a test is selected; right-hand panel with border-l). */
  get sidebar() {
    return this.page.locator("div.border-l.border-slate-200").first();
  }

  // --- Sidebar header ---
  get sidebarCloseButton() {
    return this.sidebar.getByRole("button", { name: /close/i });
  }

  get sidebarEditLink() {
    return this.sidebar.getByRole("link", { name: /edit/i });
  }

  get sidebarCaseTitle() {
    return this.sidebar.locator("span.truncate.text-sm.font-medium").first();
  }

  // --- Sidebar body ---
  get sidebarLoadingSpinner() {
    return this.sidebar.locator("[role=status]").or(this.sidebar.getByText(/loading/i));
  }

  get sidebarPreconditionsHeading() {
    return this.sidebar.getByRole("heading", { name: /preconditions/i });
  }

  get sidebarStepsHeading() {
    return this.sidebar.getByRole("heading", { name: /^steps$/i });
  }

  get sidebarNoPreconditionsOrSteps() {
    return this.sidebar.getByText(/no preconditions or steps defined/i);
  }

  // --- Sidebar tabs ---
  get sidebarTabResultsComments() {
    return this.sidebar.getByRole("button", { name: /results & comments/i });
  }

  get sidebarTabHistoryContext() {
    return this.sidebar.getByRole("button", { name: /history & context/i });
  }

  get sidebarTabDefects() {
    return this.sidebar.getByRole("button", { name: /defects/i });
  }

  get sidebarCommentTextarea() {
    return this.sidebar.getByPlaceholder(/add a comment/i);
  }

  /** Status dropdown in Results tab (Add result form). First select in sidebar body. */
  get sidebarStatusSelect() {
    return this.sidebar.locator("select").first();
  }

  get sidebarElapsedInput() {
    return this.sidebar.getByRole("spinbutton").or(this.sidebar.locator('input[type="number"]'));
  }

  get sidebarAddResultButton() {
    return this.sidebar.getByRole("button", { name: /\+ add result/i });
  }

  get sidebarPassAndNextButton() {
    return this.sidebar.getByRole("button", { name: /pass & next/i });
  }

  get sidebarStatusNextDropdown() {
    return this.sidebar.locator("select").filter({ has: this.sidebar.locator("option") }).last();
  }

  get sidebarResultHistoryHeading() {
    return this.sidebar.getByRole("heading", { name: /result history/i });
  }

  get sidebarNoVersionHistory() {
    return this.sidebar.getByText(/no version history for this case yet/i);
  }

  get sidebarDefectUrlInput() {
    return this.sidebar.getByPlaceholder(/defect url/i);
  }

  get sidebarDefectTitleInput() {
    return this.sidebar.getByPlaceholder(/title \(optional\)/i);
  }

  get sidebarAddLinkButton() {
    return this.sidebar.getByRole("button", { name: /add link/i });
  }

  get sidebarAssignToButton() {
    return this.sidebar.getByRole("button", { name: /assign to/i });
  }

  /** Open sidebar by clicking the first test row in the table. */
  async openSidebarByClickingFirstTestRow() {
    await this.firstTestRow.click();
  }

  /** Close sidebar via the Close button. */
  async closeSidebar() {
    await this.sidebarCloseButton.click();
  }
}
