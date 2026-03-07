import * as fs from "fs";
import * as path from "path";
import { test as setup } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";

const authFile = "e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_USER_EMAIL and E2E_USER_PASSWORD must be set for authenticated tests");
  }
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  const loginPage = new LoginPage(page);
  await loginPage.login(email, password);
  await page.waitForURL(/\/dashboard\/?/);
  await page.context().storageState({ path: authFile });
});
