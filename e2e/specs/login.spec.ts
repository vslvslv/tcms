import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";

test.describe("Login", () => {
  test("shows login form", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
    await expect(loginPage.registerLink).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.emailInput.fill("invalid@example.com");
    await loginPage.passwordInput.fill("wrongpassword");
    await loginPage.submitButton.click();
    await expect(loginPage.errorAlert).toBeVisible();
  });

  test("redirects to /dashboard on successful login", async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL ?? "";
    const password = process.env.E2E_USER_PASSWORD ?? "";
    const loginPage = new LoginPage(page);
    await loginPage.login(email, password);
    await expect(page).toHaveURL(/\/dashboard\/?/);
  });
});
