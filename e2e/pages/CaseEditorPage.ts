import { type Page } from "@playwright/test";
import { BasePage } from "./base";

/**
 * Add Case / Edit Case page – TestCaseForm wrapped by CaseEditor.
 * Routes: /sections/:sectionId/cases/new and /cases/:caseId/edit
 */
export class CaseEditorPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get titleInput() {
    return this.page.getByLabel(/title/i).or(this.page.getByPlaceholder("Case title"));
  }

  get saveButton() {
    return this.page.getByRole("button", { name: /save/i });
  }

  get cancelButton() {
    return this.page.getByRole("button", { name: /cancel/i });
  }

  get prerequisiteInput() {
    return this.page.getByLabel(/prerequisite/i).or(this.page.getByPlaceholder(/prerequisite/i));
  }

  /** Assert the Add/Edit Case form is loaded (title field and save visible). */
  async expectFormLoaded() {
    await this.titleInput.waitFor({ state: "visible" });
    await this.saveButton.waitFor({ state: "visible" });
  }

  /** Fill title and optional prerequisite, then save. */
  async fillAndSave(options: { title: string; prerequisite?: string }) {
    await this.titleInput.fill(options.title);
    if (options.prerequisite !== undefined) {
      await this.prerequisiteInput.fill(options.prerequisite);
    }
    await this.saveButton.click();
  }

  /** Change title and save (for edit). */
  async setTitleAndSave(newTitle: string) {
    await this.titleInput.fill(newTitle);
    await this.saveButton.click();
  }
}
