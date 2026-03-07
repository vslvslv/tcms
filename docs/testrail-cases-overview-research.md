# TestRail Cases → Overview — Research Summary

Used by the [testrail-component-replication](.cursor/skills/testrail-component-replication/SKILL.md) workflow. This document summarizes how TestRail’s **Cases → Overview** screen is described and how it maps to TCMS.

---

## 1. Sources consulted

| Source | What was used |
|--------|----------------|
| [TestRail Support – Introduction to TestRail](https://support.testrail.com/hc/en-us/articles/7076810203028-Introduction-to-TestRail) | Dashboard vs project overview; test cases and sections; navigation. |
| [TestRail Support – Test cases section](https://support.testrail.com/hc/en-us/sections/7076583974932-Test-cases) | Test case concepts (no dedicated “Cases Overview” article). |
| [TestRail Support – Getting Started Page](https://support.testrail.com/hc/en-us/articles/41981504478100-Getting-Started-Page) | Landing and sidebar access. |
| [TestRail platform](https://testrail.com/platform) | Centralized test repository, hierarchy (projects, suites, sections, cases). |
| [REPLICATION_PLAN.md](../REPLICATION_PLAN.md) | TCMS entity names and hierarchy. |

**Note:** TestRail’s support site sometimes returns a bot verification page when fetched programmatically. The live demo (e.g. copyrail123.testrail.io) was not inspected for this research. The sidebar structure (Cases with sub-items Overview, Details, Status, Defects) is taken from TestRail 9.0–style UI as referenced in our Layout.

---

## 2. What TestRail docs say

### Dashboard and project overview

- **After login:** The first page is the **dashboard**, which gives an “overview of **available projects**, recent project **activities**, and your **to-dos**.”
- **When you open a project:** Clicking a project title switches to the **project view** and lands on the **project’s overview page**, which shows:
  - **Test cases** (in context of the project)
  - **Active test runs**
  - **Project activity**
  - Other project details.

So TestRail has:

1. A **global** dashboard (projects, activity, to-dos).
2. A **project-scoped** overview (cases, runs, activity for that project).

### Test cases and sections

- Test cases are organized in **sections and sub-sections** (folder-like).
- Sections are “a collection of test cases” for specific modules or areas.
- Hierarchy: **Project → Suite(s) → Section(s) → Test case(s)** (aligned with REPLICATION_PLAN).

### Navigation

- **Project switcher:** “Click on the dropdown arrow next to the current project’s name on the left menu” to switch projects or add a new project.
- The left menu (sidebar) is the main navigation; exact “Cases → Overview” behavior is not spelled out in the articles above.

---

## 3. Interpretation of “Cases → Overview”

Given the sidebar we replicate (Cases → Overview, Details, Status, Defects), “Cases → Overview” can be interpreted in two ways:

| Interpretation | Description |
|----------------|-------------|
| **Global overview** | One page that summarizes **test cases across the instance**: e.g. list of projects with a way to open each project’s cases (or see case counts). No project selected by default; user picks a project to drill in. |
| **Project-scoped overview** | When a project is selected (e.g. via sidebar project switcher), “Cases → Overview” shows **that project’s** case summary: e.g. total cases, breakdown by status, recent activity, and links to Details/Status/Defects. |

TestRail’s docs emphasize the **project overview** (cases + runs + activity for one project). They do not explicitly define a separate “Cases → Overview” as a global list of projects. So:

- A **TestRail-aligned** Cases Overview could be **project-scoped**: show case summary and shortcuts for the **current project** (with project switcher in the layout).
- A **global** Cases Overview (list of all projects with “View cases”) is a reasonable, simple entry point when no project is selected and matches the idea of “overview of where my cases live.”

---

## 4. Layout and content (from docs)

From the Introduction and platform page:

- **Project selector** in the left sidebar (dropdown next to project name).
- **Overview-style content** often includes:
  - Test cases (summary or access)
  - Active test runs
  - Project activity

So a TestRail-like Cases Overview could include:

- **Project context:** Respect the (global) project switcher; when a project is selected, show that project’s case overview.
- **Content:** Case counts or summary, link(s) to case Details (suite/section tree), and optionally recent activity or runs.

---

## 5. TCMS current implementation

- **Route:** `/cases/overview` → `CasesOverview` page.
- **Behavior:**  
  - Title: “Test cases”; subtitle: “Overview — select a project to view and manage test cases.”  
  - Lists **all projects**; each row links to `/projects/:id` (“View cases →”).  
  - No project switcher on the page itself (layout has a global project switcher).  
  - No case counts, status breakdown, or activity.

---

## 6. Alignment and possible improvements

| Aspect | TestRail (from docs) | TCMS now | Possible improvement |
|--------|----------------------|----------|----------------------|
| Scope | Project overview = cases + runs + activity for one project | Global list of projects | Optionally make Overview project-scoped when a project is selected; keep global list when none selected. |
| Case visibility | Cases in context of project overview | Link to project; cases only after opening project | Add case count (and maybe status breakdown) per project on Overview. |
| Project switcher | Sidebar dropdown | Layout has project switcher | Use selected project on Cases Overview to show that project’s summary when available. |

Implementing these would align the Cases → Overview screen more closely with TestRail’s project overview (cases + runs + activity) and use of the project switcher.

---

## 7. Checklist (for implementation)

When implementing or refining Cases → Overview:

- [ ] Researched TestRail (docs and/or live UI) for this screen.
- [ ] Decided scope: global list only vs. project-scoped summary when project selected.
- [ ] Mapped to TCMS: projects, case counts (and status if API exists), link to Details.
- [ ] Reused Layout, Card, PageTitle, project switcher.
- [ ] Matched layout order and sections to TestRail where applicable (e.g. summary then links).
- [ ] No new feature beyond what TestRail shows for this screen without user ask.

---

*Document created from research performed 2025-03-06 for the testrail-component-replication skill.*
