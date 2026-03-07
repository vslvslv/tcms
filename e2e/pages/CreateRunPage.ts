import { type Page } from "@playwright/test";
import { BasePage } from "./base";

export class CreateRunPage extends BasePage {
  static readonly path = "/runs/new";

  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto(CreateRunPage.path);
  }

  get pageTitle() {
    return this.page.getByRole("heading", { name: /add test run/i });
  }

  get suiteSelect() {
    return this.page.locator("#suite");
  }

  get nameInput() {
    return this.page.locator("#name");
  }

  get descriptionInput() {
    return this.page.locator("#description");
  }

  get createRunButton() {
    return this.page.getByRole("button", { name: /create run/i });
  }

  get cancelButton() {
    return this.page.getByRole("button", { name: /cancel/i });
  }

  get emptyState() {
    return this.page.getByText(/select a project|no suites/i);
  }

  async createRun(suiteNameOrValue: string, name: string, description?: string) {
    await this.suiteSelect.selectOption({ label: suiteNameOrValue }).catch(() =>
      this.suiteSelect.selectOption(suiteNameOrValue)
    );
    await this.nameInput.fill(name);
    if (description !== undefined) await this.descriptionInput.fill(description);
    await this.createRunButton.click();
  }
}
