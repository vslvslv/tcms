import * as fs from "fs";
import * as path from "path";
import { test as setup } from "@playwright/test";

/**
 * Saves authenticated storageState for visual and a11y tests.
 * Requires E2E_USER_EMAIL and E2E_USER_PASSWORD env vars.
 * Uses the same admin@tcms.local / password123 credentials seeded by `npm run db:seed`.
 */
const authFile = "web/tests/visual/.auth/user.json";

setup("visual auth setup", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL ?? "admin@tcms.local";
  const password = process.env.E2E_USER_PASSWORD ?? "password123";

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard\/?/);

  await page.context().storageState({ path: authFile });
});
