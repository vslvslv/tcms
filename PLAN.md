<!-- /autoplan restore point: /c/Users/C5414063/.gstack/projects/vslvslv-tcms/development-autoplan-restore-20260404-235616.md -->
# Sprint D Plan

Generated: 2026-04-04 | Branch: development | Commit: 8b359a9
Repo: vslvslv/tcms

## Context

Sprint C shipped v0.2.0.0: version restore (5.6), AI from CI failures (14.4), transaction correctness (5.3/cases.ts). Current health score: 78/100. Post-sprint QA audit surfaced 5 deferred issues (ISSUE-002 through ISSUE-006) across run tab stubs, milestone management, report discovery, project settings, and navigation.

TCMS backlog: 138 stories, 76 done (55%), 9 partial, 53 missing. Epics 18-22 added in Sprint C gap audit — 17 stories newly tracked. Sprint D target: bring health score from 78 → 90+.

## Sprint D Scope

### Task 1 — Run Tab Stubs (Epic 18, Stories 18.1-18.3)

**18.1 Run Activity tab** — replace stub at `RunView.tsx:218` with project audit log filtered to this run
- **Pre-coding:** Add `entityId` UUID filter to `audit.ts` audit route: `if (q.entityId && isUUID(q.entityId)) conditions.push(eq(auditLog.entityId, q.entityId))`
- Call `GET /api/projects/:projectId/audit-log?entityType=run&entityId=<runId>` (NOTE: URL is `/api/projects/:projectId/audit-log` — not `/api/audit`)
- Render in a timeline list (timestamp, action, actor)
- **Empty state:** "No activity recorded for this run yet." + `Activity` icon
- Existing: `AuditLogEntry` type in `web/src/api.ts`; route at `api/src/routes/audit.ts:15`

**18.2 Run Progress tab** — replace stub at `RunView.tsx:226` with pass-rate trend chart
- Query results grouped by date from existing `results` table (joined via `tests.runId`)
- No new API needed: derive pass-rate per day from existing `GET /api/runs/:id` run object (it includes all results)
- Render with Recharts `LineChart` (already used in `Reports.tsx`)
- **Chart spec:** Y-axis = pass percentage (0-100%); X-axis = date; tooltip shows Passed/Failed/Total for that day; single line (pass rate). If < 2 data points: show "Not enough data yet" empty state instead of chart.
- **Empty state:** "No results recorded yet. Results will appear as tests are executed." + `TrendingUp` icon

**18.3 Run Defects tab** — replace stub at `RunView.tsx:230` with defect links list
- Query: all `issueLinks` where `entityType = "result"` and result's `testId` belongs to this run
- New endpoint: `GET /api/runs/:id/defects` — join `issueLinks → results → tests` where `tests.runId = :id`; cap at 250 results (consistent with other list endpoints)
- Render as link list (url, title), matching sidebar defect tab style at `RunTestCaseSidebar.tsx:376`
- **Empty state:** "No defects linked to this run." + `Bug` icon
- Effort: S (~15 min CC each)

### Task 2 — Milestone Management Completeness (Epic 20, Stories 20.1-20.3)

**20.1 Milestone edit UI** — add edit icon + inline form to `ProjectDetail.tsx:248-257` milestone list
- API: `PATCH /api/milestones/:id` already exists in `api/src/routes/milestones.ts`
- UI: pencil icon → inline edit form (name, description, due date) → Save/Cancel
- Follow existing pattern from `CasesOverview.tsx` section inline edit

**20.2 Milestone delete UI** — add delete button to milestone row
- API: `DELETE /api/milestones/:id` already exists
- Confirm before delete (window.confirm pattern, consistent with section/case delete)

**20.3 Milestone description field** — add description input to create form at `ProjectDetail.tsx:235-246`
- Schema `milestones.description` column already exists (varchar)
- Add `<textarea>` to create form; pass in PATCH payload
- Effort: XS (~10 min CC)

### Task 3 — Project Settings Redesign (Epic 21, Stories 21.1-21.5)

`ProjectSettings.tsx` is 713 lines of raw HTML with `style={{}}` inline CSS, hardcoded colors (`#c00`, `#666`, `#eee`), and no design system components. It is the most visually inconsistent page in the product.

**21.1 Tab navigation** — split into 5 tabs: General | Members | Case Config | Integrations | Danger
- **Default active tab: General** (project name, description — universal convention for settings pages; Members is second tab)
- General: project name, description
- Members: member list with role management (currently buried at line ~685)
- Case Config: case types, priorities, config groups, custom fields, case templates, datasets
- Integrations: webhooks, requirements coverage, shared steps
- Danger: delete project (typed-confirmation modal — not `window.confirm`), audit log (auto-load)
- Implement with stateful `activeTab` + tab bar using `Button` or tab nav component

**21.2 Design system tokens** — replace all `style={{}}` with Card/Button/Input components and token classes
- Remove all hardcoded color values (`#c00` → `text-error`, `#666` → `text-muted`, `#eee` → `border-border`)
- Use `Card`, `Button`, `Input`, `Select` from `web/src/components/ui/`

**21.3 Members second** — Members is second tab (General is default per universal convention)

**21.4 Auto-load audit log** — remove click-to-load; fetch on tab activation instead
- Audit log at `ProjectSettings.tsx:511` is behind manual "Load audit log" button
- Move fetch to `useEffect` triggered by `activeTab === "danger"`

**21.5 Delete actions for list items** — add delete button for case types, priorities, config groups
- Verify API routes: `DELETE /api/projects/:id/case-types/:typeId`, `DELETE /api/projects/:id/priorities/:id`
- Effort: M (~45 min CC)

### Task 4 — Global Navigation Re-organisation (Epic 22, Stories 22.1-22.4)

`Layout.tsx:72-240` is a flat nav list with no visual grouping between project-scoped and workspace content.

**22.1 Section grouping** — add "Project" and "Workspace" section headers to sidebar
- Project section: Overview, To Do, Cases (sub-menu), Runs (sub-menu), Milestones
- Workspace section: Dashboard, Reports, Admin
- Implement with small section label (`<span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted/60">`)

**22.2 Active project in sidebar** — show project name below logo/brand in sidebar
- Read from `ProjectContext`; display as truncated badge below the brand mark
- When no project selected: badge area collapses (zero height); no "Select a project" placeholder in sidebar — that lives in the page content area

**22.3 Milestone list in sidebar** — show milestone links under Milestones section
- Fetch `GET /api/projects/:id/milestones` when expanded; cache result in component state after first fetch (no re-fetch on collapse/expand)
- Render as sub-links matching `subLinkClass` pattern

**22.4 Report Builder nav link** — add "Report Builder" sub-link under Reports
- Route `/reports/builder` exists (`App.tsx:67`), linked from Reports.tsx already
- Add sub-link in sidebar matching the pattern of Cases sub-links

**22.5 Wire To Do nav item** (depends on 19.1)
- After 19.1 is built, remove `cursor-not-allowed` and `aria-disabled` from `Layout.tsx:83-86`
- Effort: M (~40 min CC)

### Task 5 — To Do Page (Epic 19, Story 19.1)

"To Do" sidebar item has been disabled since the initial design. No route exists.

**Scope correction (CEO step 0E):** `tests.assignedUserId` does NOT exist in schema (Story 2.10 was deferred). Original scope of "tests assigned to current user" is impossible without schema changes.

**Revised scope — cases awaiting action (no schema change needed):**
- Route: `/todo` → new `web/src/pages/Todo.tsx`
- Page name: **"Needs Attention"** (not "To Do" — avoids assignment semantics that don't exist yet; sidebar label stays "To Do" for nav continuity)
- Section 1: "Cases to review" — cases with `status = "ready"` in projects where current user has `cases.approve` permission. Query: `GET /api/projects/:id/cases?status=ready` per project.
- Section 2: "Open test runs" — runs with `isCompleted = false` where current user is a project member. Query: `GET /api/projects/:id/runs?is_completed=false` (NOTE: param is `is_completed`, not `completed`)
- **Performance:** cap fan-out concurrency to 5 projects at a time (use `p-limit(5)` or `Promise.all` with slice batching) — avoid firing 100 parallel requests for users in many projects
- **Loading state:** per-section skeleton (2 rows placeholder) while fetching; no full-page spinner
- **Empty state:** "You're all caught up." + `CheckCircle` icon (shown when both sections return empty)
- No new API endpoint needed — compose from existing endpoints
- Wire sidebar in 22.5 after page exists
- Effort: M (~25 min CC)

## Scope Decisions

| # | Item | Decision | Reason |
|---|------|----------|--------|
| 1 | Run tab stubs (18.1-18.3) | INCLUDE | Zero-functional pages visible in nav; QA ISSUE-005 |
| 2 | Milestone management (20.1-20.3) | INCLUDE | API done, UI gap; ISSUE-004 |
| 3 | Project Settings redesign (21.1-21.5) | INCLUDE | Worst design-system regression; ISSUE-003 |
| 4 | Navigation re-org (22.1-22.4) | INCLUDE | Discovery gaps (ReportBuilder, milestones); ISSUE-006 |
| 5 | To Do page (19.1) | INCLUDE | Nav item visible but disabled; 19.1 is prerequisite for 22.5 |
| 6 | Report builder enhancements (6.8-6.9) | DEFER Sprint E | No user demand signal yet; focus on structural issues |
| 7 | Score history chart (15.3) | DEFER Sprint E | Nice-to-have; low impact vs Epic 21/22 |
| 8 | Email notifications (Epic 11) | DEFER Sprint E | SMTP adoption < 20%; wrong persona for solo contractor |
| 9 | 2.10 Test assignment | DEFER Sprint E | Blocker S1 (members/assignable endpoint) unresolved |
| 10 | Global search (12.1) | DEFER Sprint E | Post-AI features validate the angle |

## Implementation Order

1. Run tab stubs (18.1-18.3) — smallest, unblock ISSUE-005
2. Milestone management (20.1-20.3) — XS/S, completes API gap
3. To Do page (19.1) — prerequisite for 22.5
4. Navigation re-org (22.1-22.5) — depends on 19.1 for wire-up
5. Project Settings redesign (21.1-21.5) — largest, last (safe to iterate)

## Total Estimated Effort

~2-2.5 hours CC. Human equivalent: 1.5 days.

## Dependencies

- **18.1 (BLOCKER):** Add `entityId` UUID filter to `GET /api/projects/:projectId/audit-log` in `audit.ts` before coding the Activity tab
- 18.3: New endpoint `GET /api/runs/:id/defects` — join `issueLinks → results → tests`; cap 250 rows
- 20.1-20.2: `PATCH /DELETE /api/milestones/:id` exist in `milestones.ts`
- 21.5: Delete routes at `DELETE /api/case-types/:id` and `DELETE /api/priorities/:id` (verified: `caseTypes.ts:92`, `priorities.ts:92`)
- 22.3: Milestone fetch on sidebar expand — use `GET /api/projects/:id/milestones` (already called in `ProjectDetail.tsx`)
- 22.5: Depends on 19.1 (To Do page must exist before enabling nav link)

## Success Criteria

- Run Activity tab shows project audit log filtered to run entity
- Run Progress tab shows pass-rate trend by day (Recharts LineChart)
- Run Defects tab shows all issue links for tests in this run
- Milestones in ProjectDetail have edit + delete + description field
- ProjectSettings uses tabbed layout with 5 tabs, zero `style={{}}` inline CSS, design tokens throughout
- Sidebar has "Project" and "Workspace" section headers; shows active project name; Report Builder linked
- `/todo` route renders; sidebar To Do link is enabled
- Health score target: 90+

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — running full /autoplan pipeline below.

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | Include all Epics 18-22 | Mechanical | P1 (completeness) | All 5 deferred QA issues must close | Option C (partial) |
| 2 | CEO | Defer email to Sprint E | Mechanical | P3 (pragmatic) | Low SMTP adoption, wrong persona | Add email to Sprint D |
| 3 | CEO | Proceed with Sprint D despite maintenance nature | Mechanical | P6 (bias toward action) | Hygiene sprint valid before next AI feature sprint | Block for competitive reason |
| 4 | CEO | 19.1 rename to "Needs Attention" | TASTE DECISION | P5 (explicit) | "To Do" implies assignment semantics that don't exist | Keep "To Do" name |
| 5 | CEO | Retain 21.2-21.5 (full settings redesign) | TASTE DECISION | P1 (completeness) | Subagent recommends cutting 21.2-21.5; completeness says boil the lake | Cut 21.2-21.5 |
| 6 | Design | Run tab empty states — add specs to plan | Mechanical | P1 (completeness) | Cannot ship stub replacements without empty states | Defer to implementer |
| 7 | Design | Progress chart — add axis/tooltip spec | Mechanical | P5 (explicit) | Implementer makes 4 silent product decisions without spec | Leave unspecified |
| 8 | Design | To Do loading + empty states — add to plan | Mechanical | P1 (completeness) | Most common state unspecified | Defer to implementer |
| 9 | Design | Settings default tab: General (not Members) | Mechanical | P5 (explicit) | Universal settings page convention; designer finding F4 | Members-first |
| 10 | Design | Project delete: typed-confirmation modal | Mechanical | P1 (completeness) | Highest-severity destructive action; window.confirm is a regression | window.confirm |
| 11 | Design | Sidebar no-project: collapse badge area | Mechanical | P5 (explicit) | Defines the missing state explicitly | Show placeholder |
| 12 | Eng | Add entityId filter to audit route (BLOCKER) | Mechanical | P1 (completeness) | 18.1 will show wrong data without it | Code around missing filter |
| 13 | Eng | Fix audit URL in plan (BLOCKER) | Mechanical | P5 (explicit) | Frontend would 404 on wrong URL | Leave incorrect |
| 14 | Eng | Fix To Do query param: is_completed not completed | Mechanical | P5 (explicit) | Wrong param silently returns all runs unfiltered | Leave incorrect |
| 15 | Eng | Cap defects endpoint at 250 rows | Mechanical | P3 (pragmatic) | Consistent with all other list endpoints | Unlimited |
| 16 | Eng | Add p-limit(5) concurrency cap to To Do fan-out | Mechanical | P1 (completeness) | N+1 at 50 projects = 100 requests | Accept risk |
| 17 | Eng | Progress chart timezone: accept limitation | TASTE DECISION | P3 (pragmatic) | UTC bucketing adds complexity; document the limitation | Fix with UTC grouping |
| 18 | Eng | Cache milestone sidebar fetch in component state | Mechanical | P3 (pragmatic) | Repeated collapse/expand fires repeated GETs | No cache |
