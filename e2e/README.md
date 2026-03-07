# E2E Tests (Playwright)

Tests use the **Page Object** pattern and run against the web app.

## Prerequisites

- **Web app** running at `http://localhost:5001` (e.g. `cd web && npm run dev`)
- **API** running at `http://localhost:3001` (e.g. `cd api && npm start`)

## Running tests

From the **repo root**:

```bash
# Login-only tests (no auth required)
npm run test:e2e -- --project=chromium-unauth

# All tests (requires a test user)
E2E_USER_EMAIL=your@email.com E2E_USER_PASSWORD=yourpassword npm run test:e2e

# UI mode
npm run test:e2e:ui

# Headed (see browser)
npm run test:e2e:headed
```

## Authenticated tests

Set `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` for specs that need a logged-in user. The **setup** project runs first, logs in once, and saves session state to `e2e/.auth/user.json`. After login, users are redirected to **/dashboard** (default route). The **chromium** project reuses that state so tests start already authenticated.

**globalSetup** runs the Backoffice seed (`api`’s `db:seed:backoffice`) so the project “Backoffice” with suites, sections, and cases exists. Cases and runs specs rely on this. The “creating a run redirects to run view” test needs the API to return suites for Backoffice (e.g. `/api/projects/:id/suites`) within the test timeout so the Create Run form appears.

To remove E2E test data that was created by earlier runs (before in-test cleanup was added), from the repo root run: `cd api && npm run db:cleanup:e2e`. This deletes entities whose names start with `E2E ` (projects, runs, sections, test cases). Safe to run multiple times.

## Structure

- `e2e/pages/` – page objects (Login, Projects, Sidebar, CasesOverview, RunsOverview, CreateRun, RunView)
- `e2e/specs/` – test files and `auth.setup.ts`
- `e2e/fixtures/auth.ts` – optional fixture that provides a `sidebar` for authenticated tests
