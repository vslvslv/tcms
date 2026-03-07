import { type Page, expect } from "@playwright/test";

/**
 * Sidebar fragment – available on any authenticated page that uses Layout.
 * Does not have its own URL; use from a page that has already navigated.
 */
export class Sidebar {
  constructor(private readonly page: Page) {}

  get nav() {
    return this.page.getByTestId("sidebar-nav");
  }

  get projectSwitcher() {
    return this.page.getByRole("listbox").or(this.page.locator("[aria-haspopup='listbox']"));
  }

  get casesSectionButton() {
    return this.nav.getByRole("button", { name: /cases/i });
  }

  get casesOverviewLink() {
    return this.nav.locator('a[href="/cases/overview"]');
  }

  get runsSectionButton() {
    return this.nav.getByRole("button", { name: /test runs/i });
  }

  get runsOverviewLink() {
    return this.nav.locator('a[href="/runs/overview"]');
  }

  get addTestRunButton() {
    return this.page.getByRole("link", { name: /add test run/i }).or(this.page.getByRole("button", { name: /add test run/i }));
  }

  get userMenuTrigger() {
    return this.page.getByRole("button", { name: /user|log out/i }).or(this.page.locator("text=User").first());
  }

  get logOutItem() {
    return this.page.getByRole("menuitem", { name: /log out/i }).or(this.page.getByRole("link", { name: /log out/i }));
  }

  async expandCases() {
    const btn = this.nav.getByRole("button", { name: /cases/i });
    const expanded = await btn.getAttribute("aria-expanded");
    if (expanded !== "true") await btn.click();
  }

  async expandRuns() {
    const btn = this.nav.getByRole("button", { name: /test runs/i });
    const expanded = await btn.getAttribute("aria-expanded");
    if (expanded !== "true") await btn.click();
  }

  async goToCasesOverview() {
    await this.expandCases();
    await this.casesOverviewLink.click();
  }

  async goToRunsOverview() {
    await this.expandRuns();
    await this.runsOverviewLink.click();
  }

  async selectProjectByName(name: string) {
    const switcher = this.page.getByTestId("project-switcher");
    const trigger = switcher.getByRole("button");
    await trigger.waitFor({ state: "visible" });
    await expect(trigger).toBeEnabled({ timeout: 10000 });
    await trigger.click();
    const listbox = switcher.getByRole("listbox");
    await listbox.waitFor({ state: "attached", timeout: 10000 });
    await listbox.getByText(new RegExp(name, "i")).click();
  }
}
