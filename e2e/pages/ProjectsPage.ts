import { type Page } from "@playwright/test";
import { BasePage } from "./base";

export class ProjectsPage extends BasePage {
  static readonly path = "/projects";

  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto(ProjectsPage.path);
  }

  get pageTitle() {
    return this.page.getByRole("heading", { name: /projects/i });
  }

  get newProjectButton() {
    return this.page.getByRole("button", { name: /new project/i });
  }

  get projectNameInput() {
    return this.page.locator("#project-name");
  }

  get projectDescInput() {
    return this.page.locator("#project-desc");
  }

  get createProjectSubmitButton() {
    return this.page.getByRole("button", { name: /create project/i });
  }

  get cancelButton() {
    return this.page.getByRole("button", { name: /cancel/i });
  }

  get projectsTable() {
    return this.page.getByRole("table");
  }

  get viewLinks() {
    return this.page.getByRole("link", { name: /view/i });
  }

  get settingsLinks() {
    return this.page.getByRole("link", { name: /settings/i });
  }

  async openNewProjectForm() {
    await this.newProjectButton.click();
  }

  async createProject(name: string, description?: string) {
    await this.openNewProjectForm();
    await this.projectNameInput.fill(name);
    if (description !== undefined) await this.projectDescInput.fill(description);
    await this.createProjectSubmitButton.click();
  }

  /** Delete a project by name: go to its Settings and click Delete project (accepts confirm dialog). */
  async deleteProjectByName(name: string) {
    await this.goto();
    await this.page.waitForLoadState("networkidle");
    const row = this.page.getByRole("row").filter({ has: this.page.getByRole("link", { name: name }) });
    await row.getByRole("link", { name: /settings/i }).click();
    await this.page.waitForLoadState("networkidle");
    this.page.once("dialog", (d) => d.accept());
    await this.page.getByRole("button", { name: /delete project/i }).click();
    await this.page.waitForLoadState("networkidle");
  }
}
