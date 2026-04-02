# TCMS Product Backlog

Status key: ✅ Done · 🔶 API exists, UI missing · ❌ Not started

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
| 1.7 | Bulk operations on cases (move, copy, delete) | ❌ | High value |
| 1.8 | Case duplication | ❌ | |
| 1.9 | Case search / full-text filter across project | ❌ | |
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
| 2.9 | Bulk update test status within a run | ❌ | |
| 2.10 | Assign tests to specific users within a run | ❌ | |
| 2.11 | Filter tests in run view (by status, assignee) | ❌ | |
| 2.12 | Re-run failed tests — `POST /api/runs/:id/rerun-failures`, creates new run with failed cases | ❌ | **Sprint A** |
| 2.13 | Test execution timer (auto-track elapsed time) | ❌ | |

---

## Epic 3 — Attachments

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 3.1 | Attach files to test cases | ❌ | Schema exists, no API/UI |
| 3.2 | Attach files to results | ❌ | |
| 3.3 | Attach screenshots to results (manual) | ❌ | High value for QA |
| 3.3b | Auto-attach CI screenshots from Playwright import (base64 attachments in JSON report) | ❌ | Human: ~1 day / CC: ~1hr. Prereq: 3.4 |
| 3.4 | File storage backend (local disk or S3-compatible) | ❌ | Prerequisite for 3.1–3.3 |
| 3.5 | Attachment viewer in case/result detail | ❌ | |

---

## Epic 4 — Custom Fields & Templates

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 4.1 | Case field definitions (text, dropdown, number, multiline) | ✅ | API done |
| 4.2 | Case field values per case | ✅ | API done |
| 4.3 | Custom field management UI (project settings) | ✅ | Implemented in ProjectSettings.tsx |
| 4.4 | Display and edit custom fields in case editor | ✅ | Implemented in ProjectSettings.tsx |
| 4.5 | Case types management UI | ✅ | Implemented in ProjectSettings.tsx |
| 4.6 | Priorities management UI | ✅ | Implemented in ProjectSettings.tsx |
| 4.7 | Case templates (steps-based, exploratory) | 🔶 | API done, UI basic |
| 4.8 | Template library/picker when creating a case | ❌ | |
| 4.9 | Global (cross-project) custom fields | ❌ | Currently per-project only |

---

## Epic 5 — Reuse & History

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 5.1 | Shared steps (create/edit/delete) | 🔶 | API done, UI missing |
| 5.2 | Reference shared steps from a case | 🔶 | API done, no case-editor integration |
| 5.3 | Propagate shared step edits to all referencing cases | 🔶 | Logic in API, untested in UI |
| 5.4 | Case version history list | 🔶 | API done, no UI |
| 5.5 | Side-by-side case diff (version A vs B) | 🔶 | API done (`/versions/diff`), no UI |
| 5.6 | Restore a previous version | ❌ | |
| 5.7 | Test parameterization / datasets | 🔶 | API done, UI minimal |
| 5.8 | Dataset management UI (add columns, rows) | ❌ | |
| 5.9 | Per-dataset-row test instances in run | 🔶 | API creates tests per row, no run-creation UI |

---

## Epic 6 — Reporting & Dashboards

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 6.1 | Run summary (pass/fail/blocked/untested counts) | ✅ | |
| 6.2 | Plan summary with aggregated counts | ✅ | |
| 6.3 | Milestone progress view | ✅ | |
| 6.4 | Cases by status breakdown | ✅ | |
| 6.5 | Cases with linked defects report | ✅ | |
| 6.6 | Dashboard with project-level KPIs | 🔶 | Stub page, no real metrics |
| 6.7 | Pass-rate trend chart (over time per project/run) | ❌ | |
| 6.8 | Test activity feed (who ran what, when) | ❌ | |
| 6.9 | Report builder (filter, group, export) | ❌ | |
| 6.10 | Shareable report links (plan/milestone) | ✅ | Share tokens implemented |
| 6.11 | Scheduled/emailed reports | ❌ | Sprint F (requires email infra) |
| 6.12 | Export report as CSV / PDF | 🔶 | CSV export for cases/results done, no PDF |
| 6.13 | Requirements traceability matrix UI | 🔶 | API done, no UI |

---

## Epic 7 — Import & Export

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 7.1 | CSV export of cases from a section | ✅ | |
| 7.2 | CSV import of cases to a section | ✅ | |
| 7.3 | Import results from JUnit XML | ✅ | |
| 7.4 | Import results from Playwright JSON | ✅ | |
| 7.5 | Full project export (cases + runs + results) | ❌ | |
| 7.6 | TestRail CSV migration import | ❌ | |
| 7.7 | Import/export UI (wizard with field mapping) | ❌ | |

---

## Epic 8 — Integrations

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 8.1 | Link issues to cases / results | ✅ | Store URL + external ID |
| 8.2 | Webhook CRUD (admin UI to manage) | ✅ | Implemented in ProjectSettings.tsx (create + delete) |
| 8.3 | Webhook event delivery (case.created, run.completed, result.created) | ✅ | |
| 8.4 | Webhook delivery log / retry UI | ❌ | |
| 8.5 | Jira two-way integration (push defect, sync status) | ❌ | |
| 8.6 | GitHub Issues integration | ❌ | |
| 8.7 | CI/CD result ingestion (API token + endpoint docs) | 🔶 | Endpoint exists, no token auth / docs |
| 8.7b | Slack/Teams notification templates — pre-built payload templates for incoming webhooks (run.completed → Block Kit message) | ❌ | **Sprint A**. No Slack app needed; user provides incoming webhook URL |
| 8.8 | API token management (personal access tokens) | ❌ | Sprint E |

---

## Epic 9 — User & Access Management

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 9.1 | User registration + login (JWT) | ✅ | |
| 9.2 | Project member management (add/remove, assign role) | ✅ | |
| 9.3 | Admin panel: list / deactivate users | ❌ | Sprint E |
| 9.4 | Password reset — token-only MVP (no email): 2 endpoints + `passwordResetTokens` table, admin-only | ❌ | **Sprint A** (moved from E) |
| 9.5 | User profile page (name, avatar, password change) | ❌ | Sprint E |
| 9.6 | Logout — client-side only: clear localStorage token, redirect to /login | ❌ | **Sprint A** (~15 min) |
| 9.7 | Role permissions matrix (what each role can do) | ❌ | Roles exist but not enforced consistently |
| 9.8 | Fine-grained permissions (per-project, per-action) | ❌ | Sprint F |
| 9.9 | SSO — SAML 2.0 | ❌ | Gate behind first paid customer request |
| 9.10 | SSO — OAuth / OpenID Connect | ❌ | Sprint F |
| 9.11 | MFA (TOTP) | ❌ | Gate behind first paid customer request |

---

## Epic 10 — Audit & Compliance

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 10.1 | Audit log (case/run/result events) | ✅ | API done |
| 10.2 | Audit log viewer UI (filterable by user/action/date) | ✅ | Embedded in ProjectSettings.tsx; filter UI is a follow-up |
| 10.3 | Case approval workflow (approve/unapprove with sign-off) | 🔶 | API done, no UI |
| 10.4 | Approval notifications | ❌ | |
| 10.5 | Audit log export | ❌ | |

---

## Epic 11 — Notifications

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 11.1 | Email notification on run assigned | ❌ | Sprint F (requires SMTP infra) |
| 11.2 | Email notification on case approval request | ❌ | Sprint F |
| 11.3 | Email notification on result recorded | ❌ | Sprint F |
| 11.4 | In-app notification bell | ❌ | |
| 11.5 | Notification preferences (per-user opt-in/out) | ❌ | |

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
| 13.1 | Keyboard shortcuts in RunView (j/k navigate, p/f/b/s set status, n next untested, ? help panel) | ❌ | **Sprint A** (~15 min) |
| 13.2 | Dark mode | ❌ | |
| 13.3 | Responsive / mobile layout | ❌ | |
| 13.4 | Inline case editing from list view | ❌ | |
| 13.5 | Pagination on all list views | 🔶 | Some endpoints support it, not all UIs |
| 13.6 | Empty states and onboarding guide | ❌ | |

---

## Epic 14 — AI Test Generation *(new)*

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 14.1 | "Generate test steps" button in CaseEditor — calls Claude API (Haiku) with plain-text description, returns suggested steps | ❌ | Sprint E |
| 14.2 | AI-generated steps review/edit flow — user approves, edits, or discards before saving | ❌ | Sprint E |
| 14.3 | Prompt tuning — include project context (case type, priority) in Claude prompt | ❌ | Sprint E |
| 14.4 | v2: Generate from OpenAPI spec / Gherkin file upload | ❌ | Deferred post-Sprint E |

**API shape**: `POST /api/cases/:id/ai-generate-steps` → `{ steps: [{content, expected}] }`
**UX**: Long-timeout fetch (60s) with loading spinner. Claude API may take 5-30s.
**Env**: `ANTHROPIC_API_KEY` in `api/.env`

---

## Epic 15 — Release Readiness Score *(new)*

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 15.1 | Compute score per milestone: `pass_rate*60 + (1-blocker_rate)*30 + (1-flaky_pct)*10`. Returns null if no runs yet. | ❌ | Sprint D. Requires Epic 16 first. |
| 15.2 | Display score on milestone page — large number, color-coded (<60 red, 60-80 yellow, 80+ green) | ❌ | Sprint D |
| 15.3 | Score history chart (score over time) — requires `milestone_scores` table | ❌ | Deferred (no schema for time-series yet) |

---

## Epic 16 — Flaky Test Detection *(new)*

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 16.1 | Compute flakiness score per test case: count runs in last 10 where status alternated. No schema change. | ❌ | Sprint D |
| 16.2 | Dashboard panel "Top 10 flaky tests" sorted by flakiness score | ❌ | Sprint D |
| 16.3 | Badge on test row in RunView when flakinessScore > 3 | ❌ | Sprint D |

---

## Epic 17 — Smart Test Selection *(new, design-first)*

| # | Story | Status | Notes |
|---|-------|--------|-------|
| 17.1 | DB migration: `fileFailureCorrelations(id, caseId, filePath, runId, createdAt)` — per-run rows | ❌ | Sprint F. Design session first. |
| 17.2 | Extend CI import endpoint to accept optional `changedFiles: string[]` — populate `fileFailureCorrelations` | ❌ | Sprint F |
| 17.3 | `GET /api/projects/:id/suggest-tests?changedFiles=...` — ranked by last-90-day failure correlation | ❌ | Sprint F |
| 17.4 | UI: "Smart run" button — show suggested cases, user confirms, creates run with specific `caseIds` | ❌ | Sprint F |

---

## Revised Sprint Plan

### Sprint A — Foundation
1. **Logout** (9.6) — client-side token clear + redirect, 15 min
2. **Password reset** (9.4) — token-only MVP: new table + 2 endpoints + 2 pages
3. **Keyboard shortcuts** in run view (13.1) — j/k/p/f/b/s/n, 30 min
4. **Re-run failed tests** button (2.12) — new endpoint + RunView button, 45 min
5. **Slack/Teams** notification templates (8.7b) — template picker in webhook form, 30 min

*Items 4.3, 4.4, 4.5, 4.6, 8.2, 10.2 moved to Done (already implemented).*

### Sprint B — Reuse & History UI
1. **Shared steps UI** — manage + insert into case editor (5.1, 5.2)
2. **Case version history + diff UI** (5.4, 5.5)
3. **Dataset management UI** (5.8, 5.9)
4. **Case approval UI** (10.3)

### Sprint C — Attachments + CI Screenshots
1. File storage backend (3.4)
2. Attach to case/result + viewer (3.1, 3.2, 3.5)
3. Screenshot attachment from run view (3.3)
4. Auto-attach CI screenshots from Playwright import (3.3b)

### Sprint D — Reporting + Intelligence
1. Dashboard KPIs with real data (6.6)
2. Pass-rate trend chart (6.7)
3. **Flaky test detection** (Epic 16 — do first, output needed by Epic 15)
4. **Release Readiness Score** (Epic 15)
5. Report builder (6.9)

### Sprint E — User Management + AI
1. Admin panel (9.3)
2. User profile (9.5)
3. Personal API tokens (8.8)
4. **AI Test Generation** (Epic 14)

### Sprint F — Enterprise + Smart CI
1. **Smart Test Selection design session**, then implementation (Epic 17)
2. Fine-grained permissions (9.8)
3. SSO / OAuth (9.10)
4. Email infrastructure + notifications (Epic 11)

---

## Backlog Summary

| Epic | Total Stories | ✅ Done | 🔶 Partial | ❌ Missing |
|------|--------------|---------|-----------|-----------|
| 1 Core Test Design | 10 | 6 | 0 | 4 |
| 2 Test Execution | 13 | 8 | 0 | 5 |
| 3 Attachments | 6 | 0 | 0 | 6 |
| 4 Custom Fields & Templates | 9 | 6 | 2 | 1 |
| 5 Reuse & History | 9 | 0 | 7 | 2 |
| 6 Reporting & Dashboards | 13 | 5 | 3 | 5 |
| 7 Import & Export | 7 | 4 | 0 | 3 |
| 8 Integrations | 9 | 3 | 1 | 5 |
| 9 User & Access Management | 11 | 2 | 0 | 9 |
| 10 Audit & Compliance | 5 | 2 | 1 | 2 |
| 11 Notifications | 5 | 0 | 0 | 5 |
| 12 Search & Navigation | 4 | 0 | 0 | 4 |
| 13 UX & Polish | 6 | 0 | 1 | 5 |
| 14 AI Test Generation *(new)* | 4 | 0 | 0 | 4 |
| 15 Release Readiness Score *(new)* | 3 | 0 | 0 | 3 |
| 16 Flaky Test Detection *(new)* | 3 | 0 | 0 | 3 |
| 17 Smart Test Selection *(new)* | 4 | 0 | 0 | 4 |
| **Total** | **121** | **36 (30%)** | **15 (12%)** | **70 (58%)** |
