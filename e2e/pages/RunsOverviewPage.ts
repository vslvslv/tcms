import { type Page } from "@playwright/test";
import { BasePage } from "./base";

export class RunsOverviewPage extends BasePage {
  static readonly path = "/runs/overview";

  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto(RunsOverviewPage.path);
  }

  get pageTitle() {
    return this.page.getByRole("heading", { name: /test runs & results/i });
  }

  get openSection() {
    return this.page.getByRole("heading", { name: /^open$/i });
  }

  get completedSection() {
    return this.page.getByRole("heading", { name: /completed/i });
  }

  get addTestRunButton() {
    return this.page.getByRole("link", { name: /add test run/i });
  }

  get emptyState() {
    return this.page.getByText(/select a project|no test runs yet/i);
  }

  get viewProjectsButton() {
    return this.page.getByRole("button", { name: /view projects/i });
  }

  runCardByName(name: string) {
    return this.page.getByRole("link", { name });
  }

  /** Remove-run button for a run card that contains the given run name. */
  runDeleteButton(runName: string) {
    return this.page
      .locator("div")
      .filter({ has: this.page.getByRole("link", { name: runName }) })
      .filter({ has: this.page.getByRole("button", { name: /remove run/i }) })
      .getByRole("button", { name: /remove run/i })
      .first();
  }
}
