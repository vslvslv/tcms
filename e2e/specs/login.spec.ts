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

  // TC-2: Google OAuth button visible in light mode
  test("TC-2: Google sign-in button is visible in light mode", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Switch to light mode via localStorage (simulates theme toggle)
    await page.evaluate(() => {
      localStorage.setItem("tcms-theme", "light");
      document.documentElement.dataset.theme = "light";
    });
    await page.reload();

    const googleButton = page.getByRole("link", { name: /sign in with google/i });
    await expect(googleButton).toBeVisible();

    // Verify the button has readable contrast — bg-surface-raised is not white-on-white
    const bgColor = await googleButton.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    const color = await googleButton.evaluate((el) =>
      window.getComputedStyle(el).color
    );
    // Both should be non-transparent and distinguishable
    expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(color).not.toBe("rgba(0, 0, 0, 0)");
    // In light mode, background should not be pure white (#fff) since we use bg-surface-raised
    // This ensures the button is not invisible against a white page background
    expect(bgColor).not.toBe("rgb(255, 255, 255)");
  });
});
