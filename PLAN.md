<!-- /autoplan restore point: /c/Users/C5414063/.gstack/projects/vslvslv-tcms/development-autoplan-restore-20260417-170527.md -->
# Sprint F Plan

Generated: 2026-04-17 | Branch: development | Commit: ea1f5a0
Repo: vslvslv/tcms

## Context

Sprint E shipped v0.4.0.1: bulk case ops (1.7), case duplication (1.8), test assignment in run (2.10), run filter by assignee (2.11), plus 13 autoplan review bug fixes (auth, UUID display, dead button, multi-project query, audit log, migration idempotency, E2E fixtures, bulk UI polish, filter behavior).

Sprint F focuses on **product polish and discoverability**: empty states and onboarding for new users, global search across the product, quick-access recent items, and score history for milestones. Story 16.3 (flaky badge in RunView) was found already complete during autoplan code audit (RunView.tsx:474). These are the last gaps before the product is usable end-to-end by a first-time user.

---

## Sprint F Scope

### Story 13.6 — Empty States and Onboarding Guide
New users land on an empty project and see raw "no items" placeholder text — no calls to action, no help. Empty states should tell users what to do next (create a suite, add a case, create a run).
Also correct: `<EmptyState>` component already exists in `components/ui/EmptyState.tsx` (Sprint D). Many pages already use it. Gaps are: `SuiteView.tsx` (plain text), `Dashboard.tsx`, `ProjectDetail.tsx`, `RunView.tsx` (4 pages, not 5 as originally stated — Projects.tsx already covered).
**Work:** Add `<EmptyState>` with relevant CTAs to the 4 missing pages.

### Story 12.1 — Global Search Bar
Users can't discover cases or runs without navigating to a specific project first. Global search should let users find any case or run by title across all their projects.
**Work:** Search bar in the header/sidebar. `GET /api/search?q=` endpoint (or extend case search): queries `testCases` and `runs` tables with ILIKE, returns top 10 results with project name + type badge. Keyboard shortcut `Cmd/Ctrl+K` to open. Debounced, closes on Esc/outside click. Results navigate to the relevant page.

### Story 12.4 — Recent Items
Users frequently revisit the same cases and runs but must navigate through project > suite > section to get there. "Recent items" gives quick access to last-viewed pages.
**Work:** localStorage-persisted list (max 10) of recently visited cases and runs. Populated by existing navigation (no API needed). Shown in a sidebar section or as a dropdown from the header. Items show title, project name, type icon.

### Story 16.3 — Flaky Badge in RunView ✅ ALREADY DONE
**Found complete during autoplan audit.** `RunView.tsx:474` already renders `<FlakyBadge score={flakyMap.get(t.testCaseId ?? "") ?? 0} />`. flakyMap is loaded from `/api/projects/:id/flaky-tests` at mount. No work needed.

### Story 15.3 — Score History Chart
Milestone readiness score is computed per-request but never stored over time. Users can't see if their readiness score is trending up or down as testing progresses.
**Work:** New `milestoneScores` table (id, milestoneId, score, recordedAt). `POST /api/milestones/:id/score-snapshot` records current score (called after bulk status updates and result records via webhook/audit hook — or cron). Chart in `MilestoneProgress.tsx` using existing `LineChart` from Recharts (same pattern as Run Progress tab). Show "Not enough data" until 2+ data points.

---

## What Already Exists

| Sub-problem | Existing code |
|-------------|--------------|
| FlakyBadge in RunView | `web/src/pages/RunView.tsx:474` — **already wired**, story 16.3 complete |
| FlakyBadge component | `web/src/components/FlakyBadge.tsx` — renders amber chip |
| Flaky tests API | `GET /api/projects/:id/flaky-tests` — returns `{caseId, score}[]` |
| Milestone readiness score | `GET /api/milestones/:id/readiness` — `analytics.ts:148` |
| Score history pattern | Run Progress tab (`RunView.tsx`) — LineChart with daily pass % |
| Case search API | `GET /api/projects/:id/cases/search?q=` — ILIKE, 50 results |
| CaseSearchBar component | `web/src/components/CaseSearchBar.tsx` — debounced, keyboard nav |
| EmptyState component | `web/src/components/ui/EmptyState.tsx` — exists, used on 7+ pages already |
| Recent items | No implementation — localStorage is available |

---

## NOT in Scope

- Story 1.10 (drag-and-drop reorder) — needs dnd library, ocean
- Story 12.2-12.3 (saved filters, advanced filter builder) — deferred
- Epics 7, 8, 9, 11 (import/export, integrations, SSO, notifications) — enterprise tier
- Story 3.3b (CI screenshot auto-attach) — low demand

---

## Implementation Order

1. **Story 15.3** — Schema + migration for `milestoneScores`, snapshot endpoint, chart in MilestoneProgress
2. **Story 13.6** — Wire `<EmptyState>` with CTAs into 4 missing pages (SuiteView, Dashboard, ProjectDetail, RunView)
3. **Story 12.4** — Recent items in localStorage + sidebar section
4. **Story 12.1** — Global search: API endpoint + header search bar + Cmd+K shortcut

---

## Success Criteria

- [x] Flaky badge appears in RunView for cases with flakinessScore > 3 (**already done — RunView.tsx:474**)
- [ ] Milestone score history chart shows trend over time (2+ snapshots)
- [ ] Empty states with CTAs on 4 target pages (SuiteView, Dashboard, ProjectDetail, RunView)
- [ ] Recent items sidebar shows last 10 visited cases/runs with project context
- [ ] Global search finds cases + runs across all projects; Cmd+K opens it
- [ ] All new flows covered by E2E tests
- [ ] No regression in existing tests

---

## Dependencies

- Drizzle Kit available for milestoneScores migration
- Recharts already installed (used in Run Progress tab)
- FlakyBadge component already built and tested (6 unit tests)
- localStorage available (used by ThemeContext, ProjectContext)

---

## /autoplan Review — 2026-04-17

### Context
Post-plan review. Sprint F plan written fresh for new sprint after Sprint E shipped. Review ran 3 phases (CEO + Design + Eng), each with Claude subagent for independent analysis. Codex unavailable (not installed) — single-model mode `[subagent-only]`.

Key finding during Phase 0 intake: **BACKLOG.md is significantly stale.** Run tab stubs (18.1-18.3), Epic 21 (Project Settings), Epic 22 (Navigation) are all marked ❌ in BACKLOG but were shipped in Sprints D and E. Code audit was required to verify actual completeness before strategic review.

Story 16.3 (Flaky Badge in RunView) was **found already complete** during Phase 0 code audit — RunView.tsx:474 already renders `<FlakyBadge>`. Removed from Sprint F scope.

### CEO DUAL VOICES — CONSENSUS TABLE [subagent-only]
```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                   YES*    N/A    [subagent-only]
  2. Right problem to solve?           YES     N/A    [subagent-only]
  3. Scope calibration correct?        YES*    N/A    [subagent-only]
  4. Alternatives sufficiently explored?YES*   N/A    [subagent-only]
  5. Competitive/market risks covered? PARTIAL N/A    [subagent-only]
  6. 6-month trajectory sound?         YES     N/A    [subagent-only]
═══════════════════════════════════════════════════════════════
* Subagent raised Run Stubs/Epic 21/22 as unshipped alternatives — invalidated
  by code audit (all done). Finding 5 (search is commodity) is a valid taste
  concern but not blocking.
```

### DESIGN LITMUS SCORECARD [subagent-only]
```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Score
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Information hierarchy              5/10   N/A    5/10
  2. Missing states                     5/10   N/A    5/10
  3. User journey arc                   6/10   N/A    6/10
  4. Specificity of UI decisions        4/10   N/A    4/10
  5. Edge case handling                 5/10   N/A    5/10
  6. Accessibility                      5/10   N/A    5/10
  7. Trust / polish                     5/10   N/A    5/10
═══════════════════════════════════════════════════════════════
Overall design completeness: 5/10 — needs spec precision before implementation.
All 7 findings are mechanical; see HIGH BUGS section below.
```

### ENG DUAL VOICES — CONSENSUS TABLE [subagent-only]
```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Architecture sound?               YES*    N/A    [subagent-only]
  2. Test coverage sufficient?         NO      N/A    [subagent-only]
  3. Performance risks addressed?      PARTIAL N/A    [subagent-only]
  4. Security threats covered?         NO*     N/A    [subagent-only]
  5. Error paths handled?              PARTIAL N/A    [subagent-only]
  6. Deployment risk manageable?       YES     N/A    [subagent-only]
═══════════════════════════════════════════════════════════════
* Architecture sound with 5 conditions: schema explicit, trigger defined,
  global search filters by user projects, search result includes projectId,
  useRecentItems hook spec.
* Security: global search MUST filter by user's accessible projects only.
```

---

## HIGH ISSUES (implement as part of sprint — not bugs, but required spec detail)

### ISSUE 1 — Score snapshot trigger must be explicit
**File:** [api/src/routes/milestones.ts](api/src/routes/milestones.ts)
**Problem:** Plan says "called after bulk status updates and result records via webhook/audit hook — or cron" — ambiguous. If trigger is omitted, chart stays empty.
**Fix:** Call `POST /api/milestones/:id/score-snapshot` from: (1) `POST /api/results` after each result write (if the test's run has a milestoneId), and (2) as an optional daily cron via a scheduled call or admin endpoint.

### ISSUE 2 — Global search must filter by user-accessible projects
**File:** [api/src/routes/search.ts](api/src/routes/search.ts) (new file)
**Problem:** Cross-project search is a security risk if results include projects the user is not a member of.
**Fix:** Filter by `inArray(suites.projectId, userProjectIds)` where `userProjectIds` comes from both `projects` (owned) and `projectMembers` (member of) tables.

### ISSUE 3 — Global search result must include projectId for routing
**File:** [api/src/routes/search.ts](api/src/routes/search.ts) (new file)
**Problem:** Clicking a case result must navigate to `/projects/:projectId/suites/:suiteId/cases/:id`. Without projectId in response, client can't build the URL.
**Fix:** Return `{ id, type, title, projectId, suiteId }` for cases and `{ id, type, name, projectId }` for runs.

### ISSUE 4 — EmptyState CTA hierarchy (icon before CTA before message)
**File:** [web/src/components/ui/EmptyState.tsx](web/src/components/ui/EmptyState.tsx)
**Problem:** Message renders first, CTA buried below. Inverted hierarchy — new users read "No sections" and stop.
**Fix:** Restructure to: optional icon → CTA button → secondary message text.

### ISSUE 5 — Global search must handle zero results explicitly
**File:** [web/src/components/GlobalSearchBar.tsx](web/src/components/GlobalSearchBar.tsx) (new file)
**Problem:** No zero-results state specified. Empty dropdown is confusing.
**Fix:** Render "No cases or runs found. Try a different query." when results are empty and query is non-empty.

### ISSUE 6 — Cmd+K must use cross-platform listener (Ctrl+K on Windows)
**File:** [web/src/components/GlobalSearchBar.tsx](web/src/components/GlobalSearchBar.tsx) (new file)
**Problem:** Mac-only `metaKey` check breaks Windows/Linux users.
**Fix:** `if ((event.ctrlKey || event.metaKey) && event.key === 'k')`. Add visible search icon fallback in header.

### ISSUE 7 — Recent items: useRecentItems hook required with versioned storage
**File:** [web/src/hooks/useRecentItems.ts](web/src/hooks/useRecentItems.ts) (new file)
**Problem:** Plain localStorage writes without hook have race conditions in multiple tabs. No versioning.
**Fix:** Create `useRecentItems` hook listening to router navigation. Use key `tcms-recent:v1`. Emit `storage` event on write for cross-tab sync. Try-catch all storage calls.

### ISSUE 8 — Recent items location: sidebar section (not dropdown)
**File:** [web/src/components/Sidebar.tsx or Layout.tsx](web/src/pages/) (file TBD)
**Problem:** Plan says "sidebar section or dropdown" — ambiguous.
**Fix:** Render as sticky sidebar section between Milestones and Workspace group. Max 10 items showing title + project name + type icon.

### ISSUE 9 — Score history with exactly 1 data point
**File:** [web/src/pages/MilestoneProgress.tsx](web/src/pages/MilestoneProgress.tsx)
**Problem:** 2+ data points threshold doesn't cover "exactly 1" state explicitly.
**Fix:** Show "Recorded 1 snapshot. Chart appears after next test run." when `data.length === 1`.

### ISSUE 10 — Per-page empty state CTAs must be specified
**Pages:** SuiteView.tsx, Dashboard.tsx, ProjectDetail.tsx, RunView.tsx
**Problem:** Plan says "add EmptyState" but doesn't specify CTA text or href per page.
**Fix:** 
- `SuiteView.tsx` (no sections): "Add your first section" → focus section input
- `Dashboard.tsx` (no projects): "Create your first project" → `/projects/new`
- `ProjectDetail.tsx` (no runs): "Create a run" → `/runs/new?projectId=...`
- `RunView.tsx` (no tests): "Add test cases to run" → create run flow

---

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|---------|
| 1 | CEO | Remove Story 16.3 from scope | Mechanical | P4 | Already complete (RunView.tsx:474) | No |
| 2 | CEO | Keep Story 15.3 (score history) | Mechanical | P6 | Useful chart even without export | Defer |
| 3 | CEO | Defer Quick Start modal | Mechanical | P5 | Separate story, not blocking polish sprint | Add to Sprint F |
| 4 | Design | Reverse EmptyState hierarchy | Mechanical | P5 | CTA before message = standard pattern | No |
| 5 | Design | Recent items = sidebar section | Mechanical | P5 | Sidebar > dropdown for discoverability | Dropdown |
| 6 | Design | Cross-platform Cmd/Ctrl+K | Mechanical | P1 | Accessibility requirement, obvious fix | Mac-only |
| 7 | Eng | Score snapshot trigger via results.ts | Mechanical | P1 | Completeness — chart empty without trigger | Cron-only |
| 8 | Eng | Global search filter by user projects | Mechanical | P1+P4 | Security: prevent cross-project leakage | No |
| 9 | Eng | Include projectId in search response | Mechanical | P5 | Required for correct client routing | No |
| 10 | Eng | Defer flakiness scope fix (analytics.ts) | Mechanical | P3 | Out of Sprint F blast radius | Sprint G |
| 11 | Eng | Defer test audit fields (createdBy) | Mechanical | P3 | Low impact, not blocking | Sprint G |

---

## GSTACK REVIEW REPORT

| Review | Phase | Status | Findings | Critical | High |
|--------|-------|--------|----------|---------|------|
| CEO Review | Phase 1 | clean | 6 (3 false positives due to stale backlog) | 0 | 1 (search commodity — taste) |
| Design Review | Phase 2 | issues_open | 7 | 0 | 4 |
| Eng Review | Phase 3 | issues_open | 10 (2 are plan clarifications) | 0 | 3 |
| Cross-phase | All | clean | 0 | — | — |

**VERDICT:** NEEDS SPEC PRECISION — No blocking bugs (Sprint F is new work, not buggy existing code). 10 HIGH issues are implementation spec details that must be addressed during development. All are mechanical — one right answer each. No taste decisions remaining. BACKLOG.md should be updated before Sprint G to reflect actual completion state.
