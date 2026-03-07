import { test, expect } from "@playwright/test";
import { ProjectsPage } from "../pages/ProjectsPage";

test.describe("Projects", () => {
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

  test("can create a new project", async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    const name = `E2E Project ${Date.now()}`;
    await projectsPage.createProject(name);
    await expect(projectsPage.projectsTable).toBeVisible();
    await expect(page.getByRole("link", { name })).toBeVisible();
    await projectsPage.deleteProjectByName(name);
  });
});
