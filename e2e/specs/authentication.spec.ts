import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";

// ---------------------------------------------------------------------------
// Authentication & Access › Login
// ---------------------------------------------------------------------------

test.describe("Authentication & Access › Login", () => {
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

  test("Google sign-in button is visible in light mode", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await page.evaluate(() => {
      localStorage.setItem("tcms-theme", "light");
      document.documentElement.dataset.theme = "light";
    });
    await page.reload();

    const googleButton = page.getByRole("link", { name: /sign in with google/i });
    await expect(googleButton).toBeVisible();

    const bgColor = await googleButton.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    const color = await googleButton.evaluate((el) =>
      window.getComputedStyle(el).color
    );
    expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(color).not.toBe("rgba(0, 0, 0, 0)");
    expect(bgColor).not.toBe("rgb(255, 255, 255)");
  });
});

// ---------------------------------------------------------------------------
// Authentication & Access › Password Reset
// ---------------------------------------------------------------------------

test.describe("Authentication & Access › Password Reset", () => {
  test("login page shows forgot password link", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    const link = page.getByRole("link", { name: /forgot password/i });
    await expect(link).toBeVisible();
  });

  test("forgot password link navigates to reset request page", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });

  test("reset request shows confirmation with MVP link for valid email", async ({ page }) => {
    await page.goto("/reset-password");
    await page.getByLabel(/email/i).fill("admin@tcms.local");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/mvp mode/i)).toBeVisible();
    const resetLink = page.getByRole("link").filter({ hasText: /reset-password\// });
    await expect(resetLink).toBeVisible();
  });

  test("reset request shows confirmation even for unknown email (no enumeration)", async ({ page }) => {
    await page.goto("/reset-password");
    await page.getByLabel(/email/i).fill("nonexistent@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 });
  });

  test("reset confirm page validates password mismatch", async ({ page }) => {
    await page.goto("/reset-password");
    await page.getByLabel(/email/i).fill("admin@tcms.local");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/mvp mode/i)).toBeVisible({ timeout: 10000 });

    const resetLink = page.getByRole("link").filter({ hasText: /reset-password\// });
    await resetLink.click();
    await expect(page).toHaveURL(/\/reset-password\/[a-f0-9]+/);

    await page.getByLabel(/new password/i).fill("newpassword123");
    await page.getByLabel(/confirm password/i).fill("different456");
    await page.getByRole("button", { name: /reset password/i }).click();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test("full reset flow: request token, set new password, login with new password", async ({ page }) => {
    await page.goto("/reset-password");
    await page.getByLabel(/email/i).fill("admin@tcms.local");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/mvp mode/i)).toBeVisible({ timeout: 10000 });

    const resetLink = page.getByRole("link").filter({ hasText: /reset-password\// });
    await resetLink.click();
    await expect(page).toHaveURL(/\/reset-password\/[a-f0-9]+/);

    await page.getByLabel(/new password/i).fill("password123");
    await page.getByLabel(/confirm password/i).fill("password123");
    await page.getByRole("button", { name: /reset password/i }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

    const loginPage = new LoginPage(page);
    await loginPage.emailInput.fill("admin@tcms.local");
    await loginPage.passwordInput.fill("password123");
    await loginPage.submitButton.click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("back to login link works on reset request page", async ({ page }) => {
    await page.goto("/reset-password");
    await page.getByRole("link", { name: /back to login/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
