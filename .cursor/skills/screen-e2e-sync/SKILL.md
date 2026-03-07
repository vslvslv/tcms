---
name: screen-e2e-sync
description: When creating or updating a screen or major UI flow in the web app, creates or updates the corresponding e2e page object in e2e/pages/ and then creates or updates a spec file in e2e/specs/ with suitable test cases. Use when adding a new screen, changing an existing screen's structure or behavior, or when the user asks to add e2e coverage for a screen or feature.
---

# Screen → E2E Page Object and Tests Sync

When you create or update a **screen** (route/page) in the web app, do **two things** in order:

1. **Create or update the page object** in `e2e/pages/`.
2. **Create or update the spec file** in `e2e/specs/` with test cases for that screen or functionality.

---

## 1. Page object (e2e/pages/)

### Naming and location

- One page object per main screen/route.
- File: `e2e/pages/<ScreenName>Page.ts` (e.g. `CasesOverviewPage.ts`, `LoginPage.ts`).
- Class: `<ScreenName>Page`, exported.

### Structure (match existing pages)

- Extend `BasePage` from `./base`.
- `static readonly path = "/your/route"` — must match the app route.
- Constructor: `constructor(page: Page) { super(page); }`
- `async goto()` — navigates to `path` (use `baseURL`; tests use `http://localhost:5001`).
- **Getters** for every important element (buttons, inputs, headings, tables, links, empty states, errors). Use `get` so selectors are lazy and stable.
- Prefer in order: `getByRole`, `getByPlaceholder`, `getByText`, then `locator()` with stable attributes. Prefer regex for resilient text (e.g. `name: /log in/i`).
- Optional **helper methods** for repeated flows (e.g. `login(email, password)`, `selectProjectInTable(name)`).

Reference: `e2e/pages/LoginPage.ts`, `e2e/pages/CasesOverviewPage.ts`, `e2e/pages/RunsOverviewPage.ts`.

### When updating a screen

- Add getters for new elements; add or adjust helpers for new flows.
- Remove or update getters for removed/changed elements.
- Keep `path` in sync with the app route.

---

## 2. Spec file (e2e/specs/)

### Naming and location

- File: `e2e/specs/<feature>.spec.ts` (e.g. `cases-overview.spec.ts`, `login.spec.ts`). Use kebab-case; name after the feature/screen.
- One spec file per page/screen is the default; split only when a file becomes very large or you have a distinct sub-feature.

### Structure

- Import: `import { test, expect } from "@playwright/test";` and the page object(s).
- Top level: `test.describe("Human-Readable Screen/Feature Name", () => { ... });`
- Each test: `test("short description of behavior", async ({ page }) => { ... });`
- Instantiate the page: `const somePage = new SomePage(page);` inside the test (or in a helper).

### Test cases to add

Add tests that are **suitable** for the screen/functionality:

1. **Smoke** — Page loads and key content is visible (e.g. main heading, primary CTA or list).
2. **Key elements** — Critical UI elements (filters, search, tabs, main table/list) are present and visible when applicable.
3. **Main user flows** — One or more happy-path flows (e.g. select project, submit form, open an item). Prefer one flow per test; keep tests focused.
4. **Empty / edge states** — Empty state, no-project state, or error state when relevant (e.g. "shows empty state or list").
5. **Auth** — Login-only specs run in `chromium-unauth`; all other specs run in `chromium` (authenticated). Do not add login tests to authenticated spec files.

Avoid: testing implementation details, excessive duplication of the same assertion, or tests that require heavy setup unless necessary.

### Auth and projects

- **Login** is the only spec that runs unauthenticated (`chromium-unauth`). Other specs depend on `setup` and use `storageState: "e2e/.auth/user.json"`.
- For specs that need a **project** (e.g. cases overview, runs), either use a helper that selects the first project when the table is visible, or assert that either "empty state" or "content" is visible so tests pass with no projects.
- Optional: use the `sidebar` fixture from `e2e/fixtures/auth.ts` when tests are about navigation from the sidebar.

Reference: `e2e/specs/login.spec.ts`, `e2e/specs/runs-overview.spec.ts`, `e2e/specs/cases-overview.spec.ts`.

### When updating a screen

- Add tests for new behavior or new elements.
- Adjust or remove tests for removed/changed behavior.
- Keep test descriptions clear and behavior-focused.

---

## Workflow checklist

When you create or change a screen, use this checklist:

- [ ] **Page object** — `e2e/pages/<Name>Page.ts` exists and matches the screen (path, getters, helpers).
- [ ] **Spec file** — `e2e/specs/<feature>.spec.ts` exists and imports the page object.
- [ ] **Tests** — At least: page loads + key content visible; add tests for main flows and empty/edge states as appropriate.
- [ ] **Auth** — Spec runs in `chromium` (authenticated) unless it is the login spec (`chromium-unauth`).
- [ ] **Run** — From repo root: `E2E_USER_EMAIL=... E2E_USER_PASSWORD=... npm run test:e2e` (or `npm run test:e2e -- --project=chromium-unauth` for login only).

---

## Project context

- **Test dir**: `e2e/specs/` (see `playwright.config.ts`).
- **Base URL**: `http://localhost:5001` (web app); API at `http://localhost:3001`.
- **Docs**: `e2e/README.md` for run commands and auth setup.
