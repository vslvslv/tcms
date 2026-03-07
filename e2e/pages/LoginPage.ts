import { type Page } from "@playwright/test";
import { BasePage } from "./base";

export class LoginPage extends BasePage {
  static readonly path = "/login";

  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto(LoginPage.path);
  }

  get emailInput() {
    return this.page.getByRole("textbox", { name: /email/i }).or(this.page.locator("#login-email"));
  }

  get passwordInput() {
    return this.page.locator("#login-password");
  }

  get submitButton() {
    return this.page.getByRole("button", { name: /log in/i });
  }

  get registerLink() {
    return this.page.getByRole("link", { name: /register/i });
  }

  get errorAlert() {
    return this.page.getByRole("alert");
  }

  async login(email: string, password: string) {
    await this.goto();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
