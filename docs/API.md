# TCMS REST API

Overview of the REST API and optional TestRail-style mapping for migration scripts.

---

## 1. Authentication

All API routes (except `/health` and `/api/auth/*`) require a valid JWT. Send it as `Authorization: Bearer <token>`.

- `POST /api/auth/register` — register
- `POST /api/auth/login` — login (returns JWT)
- `GET /api/auth/me` — current user (authenticated)

---

## 2. REST coverage by entity

Full CRUD (list, get, create, update, delete) where applicable:

| Entity | List | Get one | Create | Update | Delete |
|--------|------|---------|--------|--------|--------|
| **Projects** | `GET /api/projects` | `GET /api/projects/:id` | `POST /api/projects` | `PATCH /api/projects/:id` | `DELETE /api/projects/:id` |
| **Suites** | `GET /api/projects/:projectId/suites` | `GET /api/suites/:id` | `POST /api/projects/:projectId/suites` | `PATCH /api/suites/:id` | `DELETE /api/suites/:id` |
| **Sections** | `GET /api/suites/:suiteId/sections` | `GET /api/sections/:id` | `POST /api/suites/:suiteId/sections`, `POST /api/sections/:parentId/sections` | `PATCH /api/sections/:id` | `DELETE /api/sections/:id` |
| **Cases** | `GET /api/sections/:sectionId/cases` | `GET /api/cases/:id` | `POST /api/sections/:sectionId/cases` | `PATCH /api/cases/:id` | `DELETE /api/cases/:id` |
| **Case versions** | `GET /api/cases/:id/versions` | `GET /api/cases/:id/versions/:versionId` | (on case create/update) | — | — |
| **Case version diff** | — | `GET /api/cases/:id/versions/diff?from=&to=` | — | — | — |
| **Runs** | `GET /api/suites/:suiteId/runs` | `GET /api/runs/:id` | `POST /api/suites/:suiteId/runs` | `PATCH /api/runs/:id` | `DELETE /api/runs/:id` |
| **Results** | `GET /api/tests/:id/results` | `GET /api/results/:id` | `POST /api/tests/:id/results` | `PATCH /api/results/:id` | — |
| **Milestones** | `GET /api/projects/:projectId/milestones` | `GET /api/milestones/:id` | `POST /api/projects/:projectId/milestones` | `PATCH /api/milestones/:id` | `DELETE /api/milestones/:id` |
| **Plans** | `GET /api/projects/:projectId/plans` | `GET /api/plans/:id` | `POST /api/projects/:projectId/plans` | `PATCH /api/plans/:id` | `DELETE /api/plans/:id` |
| **Config groups** | `GET /api/projects/:projectId/config-groups` | `GET /api/config-groups/:id` | `POST /api/projects/:projectId/config-groups` | `PATCH /api/config-groups/:id` | `DELETE /api/config-groups/:id` |
| **Config options** | (nested in group) | `GET /api/config-options/:id` | `POST /api/config-groups/:groupId/options` | `PATCH /api/config-options/:id` | `DELETE /api/config-options/:id` |
| **Case types** | `GET /api/projects/:projectId/case-types` | `GET /api/case-types/:id` | `POST /api/projects/:projectId/case-types` | `PATCH /api/case-types/:id` | `DELETE /api/case-types/:id` |
| **Priorities** | `GET /api/projects/:projectId/priorities` | `GET /api/priorities/:id` | `POST /api/projects/:projectId/priorities` | `PATCH /api/priorities/:id` | `DELETE /api/priorities/:id` |
| **Case fields** | `GET /api/projects/:projectId/case-fields` | `GET /api/case-fields/:id` | `POST /api/projects/:projectId/case-fields` | `PATCH /api/case-fields/:id` | `DELETE /api/case-fields/:id` |
| **Members** | `GET /api/projects/:projectId/members` | — | `POST /api/projects/:projectId/members` | — | `DELETE /api/projects/:projectId/members/:userId` |
| **Shared steps** | `GET /api/projects/:projectId/shared-steps` | `GET /api/shared-steps/:id` | `POST /api/projects/:projectId/shared-steps` | `PATCH /api/shared-steps/:id` | `DELETE /api/shared-steps/:id` |
| **Case templates** | `GET /api/projects/:projectId/case-templates` | `GET /api/case-templates/:id` | `POST /api/projects/:projectId/case-templates` | `PATCH /api/case-templates/:id` | `DELETE /api/case-templates/:id` |
| **Datasets** | `GET /api/projects/:projectId/datasets` | `GET /api/datasets/:id` | `POST /api/projects/:projectId/datasets` | — | `DELETE /api/datasets/:id` |
| **Issue links** | `GET /api/cases/:id/issue-links`, `GET /api/results/:id/issue-links` | — | `POST /api/cases/:id/issue-links`, `POST /api/results/:id/issue-links` | — | `DELETE /api/issue-links/:id` |

Other:

- **Import results:** `POST /api/runs/:runId/import/results` — body `application/xml` (JUnit) or `application/json` (Playwright).
- **Plan summary:** `GET /api/plans/:id/summary`
- **Milestone progress:** `GET /api/milestones/:id/progress`
- **Users / roles:** `GET /api/users`, `GET /api/roles`

---

## 3. TestRail migration mapping

For migration scripts from TestRail, map as follows (minimal set for import):

| TestRail (conceptual) | TCMS |
|------------------------|------|
| `get_projects` | `GET /api/projects` |
| `get_project/{id}` | `GET /api/projects/:id` |
| `get_suites/{project_id}` | `GET /api/projects/:projectId/suites` |
| `get_suite/{id}` | `GET /api/suites/:id` |
| `get_sections/{suite_id}` | `GET /api/suites/:suiteId/sections` (then subsections via parent) |
| `get_cases/{project_id}&suite_id={suite_id}` | List sections in suite, then `GET /api/sections/:sectionId/cases` per section |
| `get_case/{case_id}` | `GET /api/cases/:id` |
| `add_case/{section_id}` | `POST /api/sections/:sectionId/cases` |
| `get_runs/{project_id}` | List suites in project, then `GET /api/suites/:suiteId/runs` per suite |
| `get_run/{run_id}` | `GET /api/runs/:id` |
| `add_run/{suite_id}` | `POST /api/suites/:suiteId/runs` |
| `add_result/{test_id}` | `POST /api/tests/:id/results` |

TCMS uses **sections** (tree) under a suite; cases live in sections. Runs belong to a **suite** and contain **tests** (one per case, or per case×dataset row). Results are attached to **tests**. When importing from TestRail, create project → suites → sections → cases; then create runs from a suite and post results to the run’s tests (test ids are in `GET /api/runs/:id` → `tests[].id`).

For bulk result import (e.g. JUnit/Playwright), use `POST /api/runs/:runId/import/results` instead of posting one result per test.
