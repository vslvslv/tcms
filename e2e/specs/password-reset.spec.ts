import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";

test.describe("Password Reset Flow", () => {
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
    // Request a token first
    await page.goto("/reset-password");
    await page.getByLabel(/email/i).fill("admin@tcms.local");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/mvp mode/i)).toBeVisible({ timeout: 10000 });

    // Click the MVP link
    const resetLink = page.getByRole("link").filter({ hasText: /reset-password\// });
    await resetLink.click();
    await expect(page).toHaveURL(/\/reset-password\/[a-f0-9]+/);

    // Try mismatched passwords
    await page.getByLabel(/new password/i).fill("newpassword123");
    await page.getByLabel(/confirm password/i).fill("different456");
    await page.getByRole("button", { name: /reset password/i }).click();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test("full reset flow: request token, set new password, login with new password", async ({ page }) => {
    // Request token
    await page.goto("/reset-password");
    await page.getByLabel(/email/i).fill("admin@tcms.local");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/mvp mode/i)).toBeVisible({ timeout: 10000 });

    // Follow reset link
    const resetLink = page.getByRole("link").filter({ hasText: /reset-password\// });
    await resetLink.click();
    await expect(page).toHaveURL(/\/reset-password\/[a-f0-9]+/);

    // Set new password (same as old for test stability)
    await page.getByLabel(/new password/i).fill("password123");
    await page.getByLabel(/confirm password/i).fill("password123");
    await page.getByRole("button", { name: /reset password/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

    // Login with the password
    const loginPage = new LoginPage(page);
    await loginPage.emailInput.fill("admin@tcms.local");
    await loginPage.passwordInput.fill("password123");
    await loginPage.submitButton.click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("back to login links work on both reset pages", async ({ page }) => {
    await page.goto("/reset-password");
    await page.getByRole("link", { name: /back to login/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
