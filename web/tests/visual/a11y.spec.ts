import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility audit — WCAG 2.1 AA via axe-core.
 *
 * Audits 5 key pages in both dark and light themes.
 * All violations are reported with impact level, description, and element selector.
 *
 * Run:
 *   npm run test:a11y
 *
 * axe-core tags used:
 *   - wcag2a:  WCAG 2.0 Level A
 *   - wcag2aa: WCAG 2.0 Level AA
 *   - wcag21a: WCAG 2.1 Level A
 *   - wcag21aa: WCAG 2.1 Level AA
 *   - best-practice: axe best practices (non-normative)
 */

type Theme = "dark" | "light";

const THEMES: Theme[] = ["dark", "light"];

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]
): string {
  if (violations.length === 0) return "";
  return violations
    .map(
      (v) =>
        `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
        v.nodes.map((n) => `  → ${n.target.join(", ")}`).join("\n")
    )
    .join("\n\n");
}

for (const theme of THEMES) {
  test.describe(`WCAG 2.1 AA — ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t: string) => {
        window.localStorage.setItem("tcms-theme", t);
      }, theme);
    });

    test(`dashboard — ${theme}`, async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .analyze();

      expect(
        formatViolations(results.violations),
        `axe violations on /dashboard (${theme}):\n${formatViolations(results.violations)}`
      ).toBe("");
    });

    test(`projects list — ${theme}`, async ({ page }) => {
      await page.goto("/projects");
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .analyze();

      expect(
        formatViolations(results.violations),
        `axe violations on /projects (${theme}):\n${formatViolations(results.violations)}`
      ).toBe("");
    });

    test(`cases overview — ${theme}`, async ({ page }) => {
      await page.goto("/projects");
      await page.waitForLoadState("networkidle");

      const firstProject = page.getByRole("link").filter({ hasText: /backoffice/i }).first();
      await firstProject.click();
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .analyze();

      expect(
        formatViolations(results.violations),
        `axe violations on cases overview (${theme}):\n${formatViolations(results.violations)}`
      ).toBe("");
    });

    test(`runs overview — ${theme}`, async ({ page }) => {
      await page.goto("/projects");
      await page.waitForLoadState("networkidle");

      const firstProject = page.getByRole("link").filter({ hasText: /backoffice/i }).first();
      await firstProject.click();
      await page.waitForLoadState("networkidle");

      const runsLink = page.getByRole("link", { name: /runs/i }).first();
      await runsLink.click();
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .analyze();

      expect(
        formatViolations(results.violations),
        `axe violations on runs overview (${theme}):\n${formatViolations(results.violations)}`
      ).toBe("");
    });
  });
}

// Login page — unauthenticated, tested separately
for (const theme of THEMES) {
  test(`login page — ${theme}`, async ({ page }) => {
    await page.addInitScript((t: string) => {
      window.localStorage.setItem("tcms-theme", t);
    }, theme);

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    expect(
      formatViolations(results.violations),
      `axe violations on /login (${theme}):\n${formatViolations(results.violations)}`
    ).toBe("");
  });
}
