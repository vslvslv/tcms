# TCMS Product Backlog

Status key: ✅ Done · 🔶 API exists, UI missing · ❌ Not started

Last audited: 2026-04-04 (Sprint A autoplan review — code verification pass)

---

## Epic 1 — Core Test Design

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 1.1 | Project CRUD + single/multi-suite mode | ✅ | |
| 1.2 | Suite CRUD | ✅ | |
| 1.3 | Section tree (nested folders) | ✅ | |
| 1.4 | Test case CRUD with steps (action + expected result) | ✅ | |
| 1.5 | Case attributes: title, prerequisite, type, priority, status | ✅ | |
| 1.6 | Case sort order within section | ✅ | |
| 1.7 | Bulk operations on cases (move, copy, delete) | ❌ | **Sprint A** |
| 1.8 | Case duplication | ❌ | **Sprint A** |
| 1.9 | Case search / full-text filter across project | ❌ | Sprint B — PostgreSQL `tsvector` available, no new infra needed |
| 1.10 | Drag-and-drop reorder of cases and sections | ❌ | |

---

## Epic 2 — Test Execution

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 2.1 | Test run CRUD (create from suite/section) | ✅ | |
| 2.2 | Record result per test (pass/fail/blocked/skipped/untested) | ✅ | |
| 2.3 | Result comment and elapsed time | ✅ | |
| 2.4 | Result history per test | ✅ | |
| 2.5 | Run summary (counts by status) | ✅ | |
| 2.6 | Test plans with multiple runs | ✅ | |
| 2.7 | Milestones with due date + progress | ✅ | |
| 2.8 | Configurations for runs (OS, browser, device) | ✅ | |
| 2.9 | Bulk update test status within a run | ❌ | Sprint B |
| 2.10 | Assign tests to specific users within a run | ❌ | |
| 2.11 | Filter tests in run view (by status, assignee) | ❌ | |
| 2.12 | Re-run failed tests | ✅ | `POST /api/runs/:id/rerun-failures` at `runs.ts:400`; "Rerun failures" button at `RunView.tsx:254` |
| 2.13 | Test execution timer (auto-track elapsed time) | ❌ | |

---

## Epic 3 — Attachments

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 3.1 | Attach files to test cases | ✅ | `api/src/routes/attachments.ts` — S3/MinIO backend via `lib/storage.ts` |
| 3.2 | Attach files to results | ✅ | Same attachments route, supports both cases and results |
| 3.3 | Attach screenshots to results (manual) | ✅ | |
| 3.3b | Auto-attach CI screenshots from Playwright import (base64 attachments in JSON report) | ❌ | Prereq: verified 3.4 done |
| 3.4 | File storage backend (local disk or S3-compatible) | ✅ | `lib/storage.ts` — MinIO in dev, S3-compatible in prod |
| 3.5 | Attachment viewer in case/result detail | ✅ | `AttachmentPanel.tsx` renders in `TestCaseForm.tsx:714` + `RunTestCaseSidebar.tsx:419` |
| 3.5b | Inline image preview in AttachmentPanel | ✅ | `AttachmentPanel.tsx:155-168` — thumbnails + lightbox already implemented |

---

## Epic 4 — Custom Fields & Templates

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 4.1 | Case field definitions (text, dropdown, number, multiline) | ✅ | |
| 4.2 | Case field values per case | ✅ | |
| 4.3 | Custom field management UI (project settings) | ✅ | `ProjectSettings.tsx` |
| 4.4 | Display and edit custom fields in case editor | ✅ | |
| 4.5 | Case types management UI | ✅ | `ProjectSettings.tsx` |
| 4.6 | Priorities management UI | ✅ | `ProjectSettings.tsx` |
| 4.7 | Case templates (steps-based, exploratory) | 🔶 | API done, UI basic |
| 4.8 | Template library/picker when creating a case | ❌ | |
| 4.9 | Global (cross-project) custom fields | ❌ | Currently per-project only |

---

## Epic 5 — Reuse & History

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 5.1 | Shared steps (create/edit/delete) | ✅ | API + management UI in `ProjectSettings.tsx:55` |
| 5.2 | Reference shared steps from a case | ✅ | Shared step picker + insert in `TestCaseForm.tsx:337-615` |
| 5.3 | Propagate shared step edits to all referencing cases | ✅ | `sharedSteps.ts:102-111` propagates `content`+`expected` on PATCH; wrapped in `db.transaction` (Sprint C) |
| 5.4 | Case version history list | ✅ | `CaseVersionHistory.tsx:75-160` — embedded in TestCaseForm |
| 5.5 | Side-by-side case diff (version A vs B) | ✅ | `CaseVersionHistory.tsx:107-150` — diff UI done |
| 5.6 | Restore a previous version | ✅ | `POST /api/cases/:id/versions/:versionId/restore`; "Restore" button in `CaseVersionHistory.tsx` (Sprint C) |
| 5.7 | Test parameterization / datasets | ✅ | `DatasetEditor` component + `ProjectSettings.tsx` |
| 5.8 | Dataset management UI (add columns, rows) | ✅ | `DatasetEditor` component |
| 5.9 | Per-dataset-row test instances in run | 🔶 | API creates tests per row, no run-creation UI |

---

## Epic 6 — Reporting & Dashboards

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 6.1 | Run summary (pass/fail/blocked/untested counts) | ✅ | |
| 6.2 | Plan summary with aggregated counts | ✅ | |
| 6.3 | Milestone progress view | ✅ | `MilestoneProgress.tsx` |
| 6.4 | Cases by status breakdown | ✅ | |
| 6.5 | Cases with linked defects report | ✅ | |
| 6.6 | Dashboard with project-level KPIs | ✅ | `Dashboard.tsx` with recharts BarChart, flaky tests panel |
| 6.7 | Pass-rate trend chart (over time per project/run) | ✅ | `Dashboard.tsx` BarChart with `activityData` |
| 6.8 | Test activity feed (who ran what, when) | ❌ | |
| 6.9 | Report builder (filter, group, export) | ✅ | `ReportBuilder.tsx` |
| 6.10 | Shareable report links (plan/milestone) | ✅ | Share tokens + `ShareView.tsx` |
| 6.11 | Scheduled/emailed reports | ❌ | Requires email infra |
| 6.12 | Export report as CSV / PDF | 🔶 | CSV export for cases/results done, no PDF |
| 6.13 | Requirements traceability matrix UI | 🔶 | API done, no UI |

---

## Epic 7 — Import & Export

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 7.1 | CSV export of cases from a section | ✅ | `importExport.ts` |
| 7.2 | CSV import of cases to a section | ✅ | |
| 7.3 | Import results from JUnit XML | ✅ | `importResults.ts` |
| 7.4 | Import results from Playwright JSON | ✅ | |
| 7.5 | Full project export (cases + runs + results) | ❌ | Contractor portability — deferred per /office-hours |
| 7.6 | TestRail CSV migration import | ❌ | |
| 7.7 | Import/export UI (wizard with field mapping) | ❌ | |

---

## Epic 8 — Integrations

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 8.1 | Link issues to cases / results | ✅ | |
| 8.2 | Webhook CRUD (admin UI to manage) | ✅ | `ProjectSettings.tsx` — create + delete |
| 8.3 | Webhook event delivery (case.created, run.completed, result.created) | ✅ | `lib/webhooks.ts` |
| 8.4 | Webhook delivery log / retry UI | ❌ | |
| 8.5 | Jira two-way integration | ❌ | |
| 8.6 | GitHub Issues integration | ❌ | |
| 8.7 | CI/CD result ingestion (API token + endpoint docs) | ✅ | `importResults.ts`; API token auth via `ApiTokens.tsx` |
| 8.7b | Slack/Teams notification templates | ✅ | `ProjectSettings.tsx:71` — template dropdown with Block Kit + Adaptive Card presets |
| 8.8 | API token management (personal access tokens) | ✅ | `ApiTokens.tsx` + `api/src/routes/apiTokens.ts` — Sprint E |

---

## Epic 9 — User & Access Management

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 9.1 | User registration + login (JWT) | ✅ | |
| 9.2 | Project member management (add/remove, assign role) | ✅ | |
| 9.3 | Admin panel: list / deactivate users | ✅ | `AdminUsers.tsx` — toggle active/inactive |
| 9.4 | Password reset (token-only MVP) | ✅ | `auth.ts:118` — request + confirm endpoints; `ResetRequest.tsx`, `ResetConfirm.tsx`; `passwordResetTokens` table at `schema.ts:449` |
| 9.5 | User profile page | ✅ | `Profile.tsx` — name, avatar, password change |
| 9.6 | Logout | ✅ | `AuthContext.tsx:84` — clears localStorage token, called from `Layout.tsx:339` |
| 9.7 | Role permissions matrix | ✅ | `lib/permissions.ts` — admin/lead/tester matrix |
| 9.8 | Fine-grained permissions (per-project, per-action) | ✅ | `can(userId, projectId, action)` in `lib/permissions.ts` — Sprint F |
| 9.9 | SSO — SAML 2.0 | ❌ | Gate behind first paid customer request |
| 9.10 | SSO — OAuth / OpenID Connect | ✅ | `routes/oauth.ts` — Google OAuth; Sprint F |
| 9.11 | MFA (TOTP) | ❌ | Gate behind first paid customer request |

---

## Epic 10 — Audit & Compliance

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 10.1 | Audit log (case/run/result events) | ✅ | `lib/auditLog.ts` |
| 10.2 | Audit log viewer UI | ✅ | `ProjectSettings.tsx` — embedded viewer |
| 10.3 | Case approval workflow | ✅ | Approve/Revoke buttons in `TestCaseForm.tsx:478-484`; API at `cases.ts:332` |
| 10.4 | Approval notifications | ✅ | `NotificationSettings.tsx` — "case.approval_requested" preference |
| 10.5 | Audit log export | ❌ | |

---

## Epic 11 — Notifications

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 11.1 | Email notification on run assigned | ❌ | Requires SMTP infra (`lib/email.ts` exists but unused for this) |
| 11.2 | Email notification on case approval request | ❌ | |
| 11.3 | Email notification on result recorded | ❌ | |
| 11.4 | In-app notification bell | ❌ | |
| 11.5 | Notification preferences (per-user opt-in/out) | ✅ | `NotificationSettings.tsx` + `api/src/routes/notifications.ts` |

---

## Epic 12 — Search & Navigation

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 12.1 | Global search bar (cases, runs, plans) | ❌ | |
| 12.2 | Saved filters / views | ❌ | |
| 12.3 | Advanced filter builder (multiple conditions) | ❌ | |
| 12.4 | Recent items (quick-access to last-viewed cases/runs) | ❌ | |

---

## Epic 13 — UX & Polish

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 13.1 | Keyboard shortcuts in RunView | ✅ | `RunView.tsx:84-127` — j/k/p/f/b/s/n/?; help panel at line 277 |
| 13.2 | Dark mode | ✅ | `ThemeContext.tsx` — `data-theme` attribute, persisted to localStorage |
| 13.3 | Responsive / mobile layout | 🔶 | Sidebar responsive added (Phase 5), full mobile audit deferred per TODOS |
| 13.4 | Inline case editing from list view | ❌ | |
| 13.5 | Pagination on all list views | 🔶 | Some endpoints support it, not all UIs |
| 13.6 | Empty states and onboarding guide | ❌ | |

---

## Epic 14 — AI Test Generation *(new)*

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 14.1 | "Generate with AI" button in SuiteView — calls Claude API (Haiku) with context, returns suggested cases + steps | ✅ | `routes/ai.ts` + SuiteView modal — Sprint A |
| 14.2 | AI-generated cases review/accept/discard modal | ✅ | SuiteView AI modal — Sprint A |
| 14.3 | Prompt: include existing case titles for dedup + XML delimiter injection defense | ✅ | `lib/ai.ts` — Sprint A |
| 14.4 | v2: Generate from CI failures / PRD — differentiating angle | ✅ | `POST /api/projects/:id/generate-from-failure`; "Generate from CI failure" panel (Sprint C) |

**API shape**: `POST /api/projects/:id/ai/generate-cases` → `{ cases: [{title, steps: [{action, expectedResult}]}] }`  
**Env**: `ANTHROPIC_API_KEY` in `api/.env`; returns HTTP 503 with message if absent  
**Model**: `claude-haiku-4-5-20251001`

---

## Epic 15 — Release Readiness Score *(new)*

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 15.1 | Compute score per milestone: `pass_rate*60 + (1-blocker_rate)*30 + (1-flaky_pct)*10` | ✅ | `analytics.ts:148` — `/api/milestones/:id/readiness` |
| 15.2 | Display score on milestone page | ✅ | `ReadinessScore.tsx` component, used in `MilestoneProgress.tsx` |
| 15.3 | Score history chart | ❌ | Requires `milestone_scores` time-series table |

---

## Epic 16 — Flaky Test Detection *(new)*

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 16.1 | Compute flakiness score per test case | ✅ | `analytics.ts:30-81` — alternation count in last 10 results |
| 16.2 | Dashboard panel "Top 10 flaky tests" | ✅ | `Dashboard.tsx:62-72` — `flakyTests` state, loaded from `/api/projects/:id/flaky-tests` |
| 16.3 | Badge on test row in RunView when flakinessScore > 3 | ❌ | API returns score, badge not yet shown in RunView |

---

## Epic 17 — Smart Test Selection *(new)*

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 17.1 | DB table `fileFailureCorrelations` | ✅ | `schema.ts:461` — already in schema |
| 17.2 | Extend CI import to accept `changedFiles: string[]` | ✅ | `importResults.ts:212-241` — done |
| 17.3 | `GET /api/projects/:id/suggest-tests?changedFiles=...` | ✅ | `runs.ts:466-491` — done |
| 17.4 | UI: "Smart run" button | ❌ | Sprint B |

---

## Sprint Plan (Corrected — post audit 2026-04-04)

### Sprint A — True Foundation Gaps (current)
1. **Bulk operations** (1.7) — `POST /api/projects/:projectId/cases/bulk` + checkbox UI
2. **Case duplication** (1.8) — `POST /api/cases/:id/duplicate` + button
3. **oklch() validator** — `scripts/validate-oklch.mjs`
4. **Docker Playwright snapshots** — `scripts/update-snapshots.sh`
5. **Epic 14 AI Test Generation** — `lib/ai.ts` + `routes/ai.ts` + SuiteView modal

### Sprint B — Reuse UI + Remaining Intelligence
1. **Shared steps UI** (5.2) — insert into case editor
2. **Case version history + diff UI** (5.4, 5.5)
3. **Case search** (1.9) — PostgreSQL `tsvector`
4. **Epic 17 Smart Test Selection** (17.2-17.4)
5. **Flaky badge in RunView** (16.3)

### Sprint C — Attachments
1. Attachment viewer UI (3.5)
2. Auto-attach CI screenshots (3.3b)

### Sprint D — Remaining Reporting
1. Report builder enhancements (6.8, 6.9)
2. Score history chart (15.3)

### Sprint E — Contractor Portability + Enterprise
1. Full project export/import (7.5) — contractor data portability
2. SSO / OAuth finalization (9.9, 9.11)
3. Email notifications (Epic 11)

---

## Backlog Summary (audited 2026-04-04, Sprint B corrections)

| Epic | Total | ✅ Done | 🔶 Partial | ❌ Missing |
|------|-------|---------|-----------|-----------|
| 1 Core Test Design | 10 | 6 | 0 | 4 |
| 2 Test Execution | 13 | 9 | 0 | 4 |
| 3 Attachments | 6 | 4 | 0 | 2 |
| 4 Custom Fields & Templates | 9 | 7 | 1 | 1 |
| 5 Reuse & History | 9 | 5 | 2 | 2 |
| 6 Reporting & Dashboards | 13 | 8 | 2 | 3 |
| 7 Import & Export | 7 | 4 | 0 | 3 |
| 8 Integrations | 9 | 6 | 0 | 3 |
| 9 User & Access Management | 11 | 8 | 0 | 3 |
| 10 Audit & Compliance | 5 | 3 | 1 | 1 |
| 11 Notifications | 5 | 1 | 0 | 4 |
| 12 Search & Navigation | 4 | 0 | 0 | 4 |
| 13 UX & Polish | 6 | 2 | 2 | 2 |
| 14 AI Test Generation | 4 | 4 | 0 | 0 |
| 15 Release Readiness | 3 | 2 | 0 | 1 |
| 16 Flaky Detection | 3 | 2 | 0 | 1 |
| 17 Smart Test Selection | 4 | 3 | 0 | 1 |
| **Total** | **121** | **68 (56%)** | **8 (7%)** | **45 (37%)** |

Foundation is 56% complete. Sprint B code audit corrected 6 stale ❌ entries (5.2, 5.4, 5.5, 17.2, 17.3, Epic 14).
