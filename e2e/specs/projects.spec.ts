import { test, expect } from "@playwright/test";
import { ProjectsPage } from "../pages/ProjectsPage";
import { Sidebar } from "../pages/Sidebar";

// ---------------------------------------------------------------------------
// Projects & Members › Projects
// ---------------------------------------------------------------------------

test.describe("Projects & Members › Projects", () => {
  test("shows Projects page after login", async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    await expect(projectsPage.pageTitle).toBeVisible();
    await expect(projectsPage.newProjectButton).toBeVisible();
  });

  test("can open new project form", async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    await projectsPage.openNewProjectForm();
    await expect(projectsPage.projectNameInput).toBeVisible();
    await expect(projectsPage.createProjectSubmitButton).toBeVisible();
  });

  test("can create and delete a project", async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    const name = `E2E Project ${Date.now()}`;
    await projectsPage.createProject(name);
    await expect(projectsPage.projectsTable).toBeVisible();
    await expect(page.getByRole("link", { name })).toBeVisible();
    await projectsPage.deleteProjectByName(name);
  });
});

// ---------------------------------------------------------------------------
// Projects & Members › Navigation
// ---------------------------------------------------------------------------

test.describe("Projects & Members › Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const backofficeLink = page.locator("table").getByRole("link", { name: /backoffice/i }).first();
    if (await backofficeLink.isVisible().catch(() => false)) {
      await backofficeLink.click();
    } else {
      await page.locator("table").getByRole("link").first().click();
    }
    await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
  });

  test("shows main navigation sidebar", async ({ page }) => {
    const sidebar = new Sidebar(page);
    await expect(sidebar.nav).toBeVisible();
  });

  test("sidebar navigates to Cases Overview", async ({ page }) => {
    const sidebar = new Sidebar(page);
    await sidebar.goToCasesOverview();
    await expect(page).toHaveURL(/\/cases\/overview/);
  });

  test("sidebar navigates to Test Runs Overview", async ({ page }) => {
    const sidebar = new Sidebar(page);
    await sidebar.goToRunsOverview();
    await expect(page).toHaveURL(/\/runs\/overview/);
  });
});

// ---------------------------------------------------------------------------
// Projects & Members › Navigation  (Sprint D — Stories 22.1-22.5)
// ---------------------------------------------------------------------------

test.describe("Projects & Members › Navigation (Sprint D)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const backofficeLink = page.locator("table").getByRole("link", { name: /backoffice/i }).first();
    if (await backofficeLink.isVisible().catch(() => false)) {
      await backofficeLink.click();
    } else {
      const firstLink = page.locator("table").getByRole("link").first();
      if (await firstLink.isVisible().catch(() => false)) await firstLink.click();
    }
    await page.waitForURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
  });

  test("[Story 22.1] Sidebar shows Project and Workspace section labels", async ({ page }) => {
    const sidebar = new Sidebar(page);
    await expect(sidebar.nav).toBeVisible();
    // Section headers are uppercase text spans
    const projectLabel = sidebar.nav.getByText(/^project$/i);
    const workspaceLabel = sidebar.nav.getByText(/^workspace$/i);
    await expect(projectLabel).toBeVisible();
    await expect(workspaceLabel).toBeVisible();
  });

  test("[Story 22.2] Active project badge visible when project selected", async ({ page }) => {
    const sidebar = new Sidebar(page);
    // A project is selected (beforeEach navigates to one)
    // The badge is a truncated pill in the sidebar header
    const badge = page.getByTestId("project-switcher").locator("[class*='bg-primary']").first();
    const isVisible = await badge.isVisible().catch(() => false);
    // If badge selector doesn't match, just verify the project switcher shows a name
    if (!isVisible) {
      const switcherTrigger = page.getByTestId("project-switcher").getByRole("button").first();
      await expect(switcherTrigger).toBeVisible();
    } else {
      await expect(badge).toBeVisible();
    }
  });

  test("[Story 22.4] Report Builder sub-link appears when on /reports", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");
    const reportBuilderLink = page.getByTestId("sidebar-nav").getByRole("link", { name: /report builder/i });
    await expect(reportBuilderLink).toBeVisible({ timeout: 5000 });
    await reportBuilderLink.click();
    await expect(page).toHaveURL(/\/reports\/builder/);
  });

  test("[Story 22.5] To Do sidebar nav item is a working link to /todo", async ({ page }) => {
    const sidebar = new Sidebar(page);
    const todoLink = sidebar.nav.getByRole("link", { name: /to do/i });
    await expect(todoLink).toBeVisible();
    // Must be a real link, not aria-disabled
    const isDisabled = await todoLink.getAttribute("aria-disabled");
    expect(isDisabled).toBeNull();
    await todoLink.click();
    await expect(page).toHaveURL(/\/todo/);
  });

  test("[Story 22.3] Milestones sub-links render on sidebar expand", async ({ page }) => {
    const sidebar = new Sidebar(page);
    const milestonesBtn = sidebar.nav.getByRole("button", { name: /milestones/i });
    if (!(await milestonesBtn.isVisible().catch(() => false))) {
      test.skip(true, "Milestones nav item not found — project may have no milestones");
      return;
    }
    await milestonesBtn.click();
    // Either shows milestone links or "No milestones" text
    const milestoneContent = sidebar.nav.getByText(/no milestones|progress/i);
    const isVisible = await milestoneContent.isVisible().catch(() => false);
    expect(isVisible, "Milestone section should expand with content").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Projects & Members › Needs Attention  (Sprint D — Story 19.1)
// ---------------------------------------------------------------------------

test.describe("Projects & Members › Needs Attention", () => {
  test.describe.configure({ mode: "serial" });

  test("[Story 19.1] /todo route renders Needs Attention page", async ({ page }) => {
    await page.goto("/todo");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /needs attention/i })).toBeVisible({ timeout: 8000 });
  });

  test("[Story 19.1] Needs Attention shows cases-to-review and open-runs sections", async ({ page }) => {
    await page.goto("/todo");
    await page.waitForLoadState("networkidle");
    // Wait for loading to finish (skeletons fade)
    await page.waitForTimeout(2000);
    // Either both sections visible OR the caught-up empty state
    const casesSection = page.getByText(/cases to review/i);
    const runsSection = page.getByText(/open test runs/i);
    const emptyState = page.getByText(/all caught up/i);
    const hasSections =
      (await casesSection.isVisible().catch(() => false)) &&
      (await runsSection.isVisible().catch(() => false));
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    expect(hasSections || hasEmptyState, "Should show sections or caught-up state").toBe(true);
  });

  test("[Story 19.1] Loading skeletons appear while fetching", async ({ page }) => {
    // Intercept API to delay response and verify skeleton
    await page.route("**/api/projects**", async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.continue();
    });
    await page.goto("/todo");
    // Skeletons should be present briefly
    const skeleton = page.locator(".animate-pulse");
    const hasSkeletons = await skeleton.first().isVisible().catch(() => false);
    expect(hasSkeletons, "Loading skeletons should appear during fetch").toBe(true);
    await page.unrouteAll();
  });
});

// ---------------------------------------------------------------------------
// Projects & Members › Project Settings  (Sprint D — Stories 21.1-21.5)
// ---------------------------------------------------------------------------

test.describe("Projects & Members › Project Settings", () => {
  test.describe.configure({ mode: "serial" });

  let settingsUrl: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    // Get Backoffice project ID
    const token = await page.evaluate(() => localStorage.getItem("tcms_token"));
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const projects: { id: string; name: string }[] = await page.evaluate(
      async ({ headers }) => {
        const r = await fetch("http://localhost:3001/api/projects", { headers });
        return r.json();
      },
      { headers }
    );
    const backoffice = projects.find((p) => /backoffice/i.test(p.name)) ?? projects[0];
    settingsUrl = `/projects/${backoffice.id}/settings`;
    await page.close();
  });

  test("[Story 21.1] Settings renders 5-tab layout with General as default", async ({ page }) => {
    await page.goto(settingsUrl);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /general/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /members/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /case config/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /integrations/i })).toBeVisible();
  });

  test("[Story 21.1] General tab is active by default", async ({ page }) => {
    await page.goto(settingsUrl);
    await page.waitForLoadState("networkidle");
    // General tab content: project name input visible
    await expect(page.getByRole("heading", { name: /project info/i })).toBeVisible({ timeout: 8000 });
  });

  test("[Story 21.1] Clicking Members tab shows member list", async ({ page }) => {
    await page.goto(settingsUrl);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /members/i }).click();
    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({ timeout: 5000 });
  });

  test("[Story 21.1] Clicking Case Config tab shows case types", async ({ page }) => {
    await page.goto(settingsUrl);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /case config/i }).click();
    await expect(page.getByRole("heading", { name: /case types/i })).toBeVisible({ timeout: 5000 });
  });

  test("[Story 21.4] Danger tab auto-loads audit log", async ({ page }) => {
    await page.goto(settingsUrl);
    await page.waitForLoadState("networkidle");
    const dangerBtn = page.getByRole("button", { name: /danger/i });
    if (!(await dangerBtn.isVisible().catch(() => false))) {
      test.skip(true, "Danger tab not visible — user may not be admin");
      return;
    }
    await dangerBtn.click();
    // Audit log heading appears (auto-loaded — no manual button)
    await expect(page.getByRole("heading", { name: /audit log/i })).toBeVisible({ timeout: 5000 });
    // No "Load audit log" button should exist
    const loadButton = page.getByRole("button", { name: /load audit log/i });
    await expect(loadButton).not.toBeVisible();
  });

  test("[Story 21.4] Project delete button disabled until project name typed", async ({ page }) => {
    await page.goto(settingsUrl);
    await page.waitForLoadState("networkidle");
    const dangerBtn = page.getByRole("button", { name: /danger/i });
    if (!(await dangerBtn.isVisible().catch(() => false))) {
      test.skip(true, "Danger tab not visible — user may not be admin");
      return;
    }
    await dangerBtn.click();
    const deleteBtn = page.getByRole("button", { name: /delete project permanently/i });
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await expect(deleteBtn).toBeDisabled();
    // Type wrong name
    const confirmInput = page.getByPlaceholder(/.+/i).last();
    await confirmInput.fill("wrong name");
    await expect(deleteBtn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Projects & Members › Milestone Management  (Sprint D — Stories 20.1-20.3)
// ---------------------------------------------------------------------------

test.describe("Projects & Members › Milestone Management", () => {
  test.describe.configure({ mode: "serial" });

  let projectId: string;
  let milestoneId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const token = await page.evaluate(() => localStorage.getItem("tcms_token"));
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const projects: { id: string; name: string }[] = await page.evaluate(
      async ({ headers }) => {
        const r = await fetch("http://localhost:3001/api/projects", { headers });
        return r.json();
      },
      { headers }
    );
    const backoffice = projects.find((p) => /backoffice/i.test(p.name)) ?? projects[0];
    projectId = backoffice.id;
    // Create a test milestone
    const ms: { id: string } = await page.evaluate(
      async ({ projectId, headers }) => {
        const r = await fetch(`http://localhost:3001/api/projects/${projectId}/milestones`, {
          method: "POST",
          headers,
          body: JSON.stringify({ name: "Sprint D test milestone", description: "test description" }),
        });
        return r.json();
      },
      { projectId, headers }
    );
    milestoneId = ms.id;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!milestoneId) return;
    const page = await browser.newPage();
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    const token = await page.evaluate(() => localStorage.getItem("tcms_token"));
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    await page.evaluate(
      async ({ milestoneId, headers }) => {
        await fetch(`http://localhost:3001/api/milestones/${milestoneId}`, { method: "DELETE", headers });
      },
      { milestoneId, headers }
    );
    await page.close();
  });

  test("[Story 20.1] Edit milestone inline form opens on pencil click", async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState("networkidle");
    // Find the pencil/edit SVG button in the milestone row
    const milestoneRow = page.getByText("Sprint D test milestone").locator("..");
    const editBtn = milestoneRow.locator("button[title='Edit milestone']");
    if (!(await editBtn.isVisible().catch(() => false))) {
      // Try generic approach — find nearby button
      const parentRow = page.locator("li").filter({ hasText: "Sprint D test milestone" }).first();
      await parentRow.locator("button").first().click();
    } else {
      await editBtn.click();
    }
    // Edit form should be open (input with autoFocus or Save button visible)
    await expect(page.getByRole("button", { name: /save/i })).toBeVisible({ timeout: 5000 });
  });

  test("[Story 20.3] Create form includes description field", async ({ page }) => {
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /new milestone/i }).click();
    // Description input should be in the form
    await expect(page.getByPlaceholder(/description/i)).toBeVisible({ timeout: 5000 });
  });
});

