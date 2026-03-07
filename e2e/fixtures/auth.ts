import { test as base } from "@playwright/test";
import { Sidebar } from "../pages/Sidebar";

/**
 * Fixture for authenticated tests. Use when the project already has storageState
 * applied (logged-in session). Provides the Sidebar fragment for the current page.
 */
export const test = base.extend<{ sidebar: Sidebar }>({
  sidebar: async ({ page }, use) => {
    await use(new Sidebar(page));
  },
});

export { expect } from "@playwright/test";
