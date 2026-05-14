<!-- /autoplan restore point: /c/Users/C5414063/.gstack/projects/vslvslv-tcms/development-autoplan-restore-20260417-182008.md -->
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

### Story X.1 — CasesOverview Redesign + Design Token Alignment *(added Run 4)*
The Cases Overview page was redesigned (post-plan) from an accordion/card layout to a three-panel master-detail layout: left section tree, flat case table (32px rows, status dots, priority badges), and a slide-in detail panel. Design tokens in `index.css` were also updated to match DESIGN.md (teal `#4E9B8F`, Geist font, obsidian `#141418`). Typography in `CasesDetails.tsx` was updated to use Instrument Serif italic for suite names.
**Work already done (uncommitted):** `CasesOverview.tsx` (three-panel layout), `index.css` (token + font alignment), `CasesDetails.tsx` (Instrument Serif suite names).
**Remaining work:** Commit the design work, fix 4 new issues (ISSUE 28–31), add success criteria, add 1 E2E smoke test.

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

1. **Story X.1** — Commit CasesOverview redesign + design token alignment; fix ISSUE 28–31
2. **Story 15.3** — Schema + migration for `milestoneScores`, snapshot endpoint, chart in MilestoneProgress
2. **Story 13.6** — Wire `<EmptyState>` with CTAs into 4 missing pages (SuiteView, Dashboard, ProjectDetail, RunView)
3. **Story 12.4** — Recent items in localStorage + sidebar section
4. **Story 12.1** — Global search: API endpoint + header search bar + Cmd+K shortcut

---

## Success Criteria

- [x] Flaky badge appears in RunView for cases with flakinessScore > 3 (**already done — RunView.tsx:474**)
- [ ] CasesOverview three-panel layout renders correctly: section tree, case table, slide-in detail panel
- [ ] Design tokens match DESIGN.md: teal primary, obsidian background, Geist font, JetBrains Mono for IDs
- [ ] Empty state on CasesOverview (when no section selected) uses `<EmptyState variant="cta">`
- [ ] Recent items tracks case views from panel opens (not just URL navigation)
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

## Architecture (Run 4 — Story X.1 included)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Browser (React + Vite, port 5001)                                          │
│                                                                             │
│  App.tsx (React Router v7)                                                  │
│  └─ Layout.tsx                                                              │
│     ├─ useRecentItems()  ← useLocation() hook — tracks page visits          │
│     ├─ Sidebar                                                              │
│     │  ├─ ProjectContext (current project, localStorage)                    │
│     │  ├─ Recent Items section  ← Story 12.4                               │
│     │  └─ GlobalSearchBar (Cmd+K modal)  ← Story 12.1                      │
│     └─ <Routes>                                                             │
│        ├─ /projects/:id/cases  → CasesOverview.tsx  ← Story X.1            │
│        │  ├─ LEFT: SectionTreeNode[] (depth indented, keyboard nav)         │
│        │  │   state: selectedSectionId                                      │
│        │  ├─ CENTER: case table (32px rows, fixed layout)                   │
│        │  │   state: selectedCaseId, visibleCases (useMemo)                 │
│        │  │   sub-components (module-scoped): StatusDot, PriorityBadge      │
│        │  └─ RIGHT: detail panel (fixed, z-50, slide-in)                   │
│        │      state: detailPanelOpen                                        │
│        ├─ /projects/:id/suites/:sid  → CasesDetails.tsx (suite view)       │
│        │  └─ Suite name: Instrument Serif italic (var(--font-serif))        │
│        ├─ /milestones/:id  → MilestoneProgress.tsx                         │
│        │  └─ Score history chart (Recharts LineChart)  ← Story 15.3        │
│        └─ /dashboard  → Dashboard.tsx (EmptyState CTAs)  ← Story 13.6      │
│                                                                             │
│  Shared lib:                                                                │
│  ├─ web/src/lib/sectionTree.ts  → buildSectionTree() (shared by both pages) │
│  └─ web/src/hooks/useRecentItems.ts  → pushItem(), useRecentItems()         │
└─────────────────────────────────────────────────────────────────────────────┘
         │ fetch (api.ts) + JWT
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  API (Fastify + Drizzle, port 3001)                                         │
│                                                                             │
│  routes/                                                                    │
│  ├─ cases.ts          GET /projects/:id/cases  (suites-with-sections)       │
│  ├─ search.ts         GET /search?q=  (cases + runs, ILIKE, user-scoped)    │
│  ├─ results.ts        POST/PATCH /results  → triggers score snapshot        │
│  │                    assertProjectAccess (NOT owner-only — ISSUE 57 fix)   │
│  └─ milestones.ts     GET /milestones/:id/scores  ← Story 15.3              │
│                       POST /milestones/:id/score-snapshot                   │
│                                                                             │
│  lib/                                                                       │
│  ├─ milestoneScores.ts  triggerSnapshot() helper (POST + PATCH both call)   │
│  ├─ projectAccess.ts    assertProjectAccess()                               │
│  └─ permissions.ts      can(userId, projectId, action)                      │
└─────────────────────────────────────────────────────────────────────────────┘
         │ Drizzle ORM
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (port 5432)                                                     │
│                                                                             │
│  testCases   (id, title, status, priority, sectionId, suiteId, projectId)  │
│  sections    (id, name, parentId, suiteId)                                  │
│  suites      (id, name, projectId)                                          │
│  runs        (id, name, projectId, milestoneId)                             │
│  results     (id, testId, status, comment)                                  │
│  milestones  (id, name, projectId)                                          │
│  milestoneScores  (id, milestoneId, score, passRate, recordedAt)  ← NEW     │
└─────────────────────────────────────────────────────────────────────────────┘

CSS Token Layer (index.css):
  --color-primary:    oklch(0.623 0.087 181.4)   ← teal #4E9B8F
  --color-background: oklch(0.164 0.018 275.9)   ← obsidian #141418
  --color-surface:    oklch(0.189 0.018 275.9)   ← #1E1E24
  --color-muted2:     oklch(0.45 0.018 275.9)    ← NEW (ISSUE 38 fix)
  --font-sans:   'Geist', sans-serif
  --font-serif:  'Instrument Serif', serif
  --font-mono:   'JetBrains Mono', monospace
```

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

### ISSUE 10 — Per-page empty state CTAs must be specified (Run 1) — EXPANDED in Run 3
**Pages:** SuiteView.tsx, Dashboard.tsx, ProjectDetail.tsx, RunView.tsx
**Problem:** Plan says "add EmptyState" but doesn't specify CTA text or href per page.
**Fix (expanded):**
- `SuiteView.tsx` (no sections): "Add your first section" → focus section input
- `Dashboard.tsx` — ALL 4 cards need specs (see ISSUE 15 below)
- `ProjectDetail.tsx` (no runs): "Create a run" → `/runs/new?projectId=...`
- `RunView.tsx` (no tests, no filter active): "Add test cases to run" → create run flow; **if filter active, CTA must be hidden** — "Clear filters" link is the correct affordance (already present at RunView.tsx:405)

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
| 12 | Eng (re-run) | Auth + project access on snapshot endpoint | Mechanical | P1 | Security: jwtVerify + assertProjectAccess required, same as all other routes | Skip |
| 13 | Eng (re-run) | Search pagination + DB index | Mechanical | P1+P3 | ILIKE full-table scan at 10x users is a performance cliff | No pagination |
| 14 | CEO (re-run) | Guided onboarding (Quick Start modal) — keep deferred | Mechanical | P5 | Separate story; deferred in Decision 3; new session subagent agrees it's a separate concern | Sprint F |
| 15 | CEO (re-run) | Add competitor-moat feature to Sprint G planning | Mechanical | P6 | Search + recent items are table stakes; Sprint G should include a differentiating execution feature | Ignore |
| 16 | CEO (Run 3) | Add primary persona statement to plan | Mechanical | P5 | Explicit beats assumed — QA engineers + team leads named | Omit |
| 17 | CEO (Run 3) | Add "why we win" paragraph | Mechanical | P5 | Competitive differentiation must be stated | Omit |
| 18 | CEO (Run 3) | Add localStorage scope statement | Mechanical | P5 | Cross-device sync is an explicit non-goal, must be documented | Omit |
| 19 | CEO (Run 3) | Add guided onboarding reasoning to Decision 3 | Mechanical | P5 | CTAs per page > single modal — reason documented | Omit |
| 20 | CEO (Run 3) | Keep Story 15.3 — 16 milestones in prod DB | Taste | P6 | Subagent said low leverage; DB check shows milestones actively used | Defer 15.3 |
| 21 | CEO (Run 3) | Add first-run walkthrough to success criteria | Taste | P6 | Premise validation is good practice; walkthrough confirms empty-state coverage | Skip |
| 22 | Design (Run 3) | EmptyState: add variant prop (not reorder all sites) | Mechanical | P5 | Backward-compat: existing 7+ sites unaffected; onboarding pages use variant="cta" | Reorder all |
| 23 | Design (Run 3) | GlobalSearchBar = Cmd+K modal overlay | Mechanical | P5 | Closes on Esc, backdrop, keyboard nav = modal pattern; inline input doesn't match behavior | Inline header |
| 24 | Design (Run 3) | Dashboard: all 4 cards need empty state CTAs | Mechanical | P1 | 4 bare `<p>` confirmed at lines 200/235/260/288 | Projects-only |
| 25 | Design (Run 3) | RunView CTA conditional on filter state | Mechanical | P5 | CTA only when no active filters; existing "Clear filters" link handles filtered empty | Unconditional |
| 26 | Design (Run 3) | useRecentItems mounts in Layout.tsx via useLocation | Mechanical | P5 | React Router v7 has no nav events; useLocation in router tree is only correct approach | Event listener |
| 27 | Design (Run 3) | Recent items store full URL path | Mechanical | P5 | ID reconstruction requires context unavailable in sidebar | Store IDs only |
| 28 | Eng (Run 3) | Score = passRate formula | Mechanical | P5 | Only scalar available; matches ReadinessScore component | Composite score |
| 29 | Eng (Run 3) | Snapshot cooldown: 1-minute guard | Mechanical | P3 | 500 concurrent snapshots = 2,500 queries; guard is 1 line | No guard |
| 30 | Eng (Run 3) | useRecentItems: filter to entity URLs only | Mechanical | P1 | Without filter, list records /dashboard, /projects/new etc. | Record all routes |
| 31 | Eng (Run 3) | Add GET /api/milestones/:id/scores endpoint | Mechanical | P5 | Chart has no read path without it | Omit |
| 32 | Eng (Run 3) | milestoneScores in schema.ts first | Mechanical | P5 | Drizzle requires schema before migration generation | Handwrite SQL |
| 33 | Eng (Run 3) | Dedup recent items by URL | Mechanical | P5 | Strict Mode double-render adds duplicates | No dedup |
| 34 | Eng (Run 3) | Defer search rate-limit to Sprint G | Mechanical | P3 | fastify-rate-limit not installed; LIMIT 10 sufficient mitigation | Install now |
| 36 | CEO (Run 4) | Add Story X.1 — CasesOverview redesign + design tokens | Mechanical | P1 | Work exists uncommitted; needs story tracking, success criteria, issues | Omit |
| 37 | CEO (Run 4) | Keep CasesDetails.tsx active; mark for Sprint G deprecation | Mechanical | P5 | Deleting now risks broken sidebar links; defer to Sprint G consolidation | Delete now |
| 38 | CEO (Run 4) | CasesOverview layout: master-detail panel over expand-in-place | Taste | P5 | User confirmed master-detail; alternatives (expand-in-place, accordion+table) dismissed without explicit planning session | Alternatives |
| 39 | CEO (Run 4) | Empty state on new primary page must use `<EmptyState variant="cta">` | Mechanical | P1 | Self-contradiction: sprint fixes empty states everywhere except its own new page | Skip |
| 40 | CEO (Run 4) | `pushItem()` export from useRecentItems for panel-click tracking | Mechanical | P1 | Without it, recent items is broken for the redesign's primary interaction pattern | No export |
| 41 | CEO (Run 4) | Scope `*` transition rule to interactive elements | Mechanical | P3 | Pre-existing bug amplified by large table; 1-line fix | Leave as `*` |
| 42 | Design (Run 4) | Detail panel z-index: 40 conflicts with sidebar at 30 — raise to 50 | Mechanical | P1 | Fixed panel covers sidebar on mobile/narrow viewport; raising panel resolves overlap | Leave at 40 |
| 43 | Design (Run 4) | Define `--color-muted2` token in index.css | Mechanical | P1 | CasesOverview.tsx references it; missing token renders as invalid value (transparent) | Rename usages |
| 44 | Design (Run 4) | Replace `#D97B45` with priority token in design system | Mechanical | P1 | Hardcoded hex bypasses theme system; dark/light modes break | Keep hardcoded |
| 45 | Design (Run 4) | Section tree: add keyboard nav (arrow keys + Enter) | Mechanical | P1 | WCAG 2.1 SC 2.1.1 requires keyboard operability for all interactive controls | Mouse-only |
| 46 | Design (Run 4) | Case table rows: add keyboard nav + role="button" or `<button>` wrapper | Mechanical | P1 | `<tr onClick>` is not keyboard accessible; screen readers skip it | Leave as `<tr>` |
| 47 | Design (Run 4) | Hoist StatusDot/PriorityBadge/SectionTreeNode to module scope | Mechanical | P3 | Re-created every render; compounds with 500-row table into visible sluggishness | Leave inline |
| 48 | Design (Run 4) | Delete dead code block at lines 603–657 | Mechanical | P1 | Identical duplicate; dead code path; contains design token violation | Leave duplicate |
| 49 | Eng (Run 4) | Rewrite CasesOverviewPage.ts e2e page object for new DOM | Mechanical | P1 | Old selectors target non-existent elements; entire e2e suite for cases is broken | Leave stale |
| 50 | Eng (Run 4) | Move all case filtering client-side (or all server-side) | Mechanical | P1 | Mixed client/server filtering produces wrong status bar counts | Accept inconsistency |

---

### ISSUE 11 — Auth guard on score-snapshot endpoint (NEW — re-run 2026-04-17)
**File:** [api/src/routes/milestones.ts](api/src/routes/milestones.ts)
**Problem:** `POST /api/milestones/:id/score-snapshot` must call `await request.jwtVerify()` and `assertProjectAccess(request, milestone.projectId)`. The plan doesn't specify this — easy to forget since snapshot is also triggered internally from results.ts.
**Fix:** Standard auth guard: `await request.jwtVerify(); const ms = await db.select()...; assertProjectAccess(request, ms.projectId);` — same pattern as all other milestone routes.

### ISSUE 12 — Search needs DB index + pagination (NEW — re-run 2026-04-17)
**File:** [api/src/routes/search.ts](api/src/routes/search.ts) (new file)
**Problem:** ILIKE search over `testCases.title` and `runs.name` without an index does a full-table scan. With 500+ cases per project and multiple projects, response time will exceed 200ms at 10x users.
**Fix:** Add `CREATE INDEX CONCURRENTLY idx_cases_title_trgm ON test_cases USING gin(title gin_trgm_ops)` (requires `pg_trgm` extension) OR simply limit to `LIMIT 10` with `ORDER BY relevance` and document the constraint. Use trigram extension if pg_trgm is available; otherwise accept ILIKE with the 10-result cap.

---

### ISSUE 13 — EmptyState component: add `variant` prop to avoid breaking 7+ existing usages (NEW — Run 3)
**File:** [web/src/components/ui/EmptyState.tsx](web/src/components/ui/EmptyState.tsx)
**Problem:** ISSUE 4 restructures render order (CTA-before-message) for onboarding contexts. But the current component is used in 7+ call sites for filter/search empty states where message-first is correct ("No cases match your filters"). A direct reorder breaks those usages.
**Fix:** Add `variant?: "default" | "cta"` prop. `"default"` (backward compat) = message then action. `"cta"` = optional icon then action then message. The 4 new onboarding pages use `variant="cta"`. Existing pages stay on `"default"`. Also add `icon?: ReactNode` as an optional prop consumed only in `"cta"` variant. Suggested icons: PlusCircle (SuiteView), FolderOpen (Dashboard/ProjectDetail), PlayCircle (RunView) from Lucide.

### ISSUE 14 — GlobalSearchBar is a Cmd+K modal overlay, not an inline header input (NEW — Run 3)
**File:** [web/src/components/GlobalSearchBar.tsx](web/src/components/GlobalSearchBar.tsx) (new file)
**Problem:** Plan says "search bar in the header/sidebar" — ambiguous. Cmd+K semantics + "closes on Esc/outside click" + keyboard navigation in results all describe a floating modal palette, not an inline input.
**Fix:** GlobalSearchBar renders as: a small search icon button in the header nav (always visible). `Cmd/Ctrl+K` OR clicking the icon opens a centered modal overlay (`fixed inset-0 z-50 flex items-start justify-center pt-[15vh]`) with a backdrop and a search input + results list. Close on Esc or backdrop click. Same `<Modal>` primitive used elsewhere in the codebase (web/src/components/ui/Modal.tsx). No persistent input in the header.

### ISSUE 15 — Dashboard: all 4 card empty states need specs (NEW — Run 3)
**File:** [web/src/pages/Dashboard.tsx](web/src/pages/Dashboard.tsx)
**Problem:** Dashboard has 4 bare `<p className="text-muted">` empty states (line 200, 235, 260, 288). ISSUE 10 only specified the projects card.
**Fix:** Replace all 4 with `<EmptyState variant="cta">`:
- Projects (line 200): icon=FolderOpen, action="Create your first project" → `/projects/new`, message="No projects yet."
- Milestones (line 235): icon=Flag, action="Add a milestone" → active project's settings (or `/projects` to select first), message="No upcoming milestones."
- Test Plans (line 260): icon=ClipboardList, action="Create a plan" → omit if no project context, message="No test plans yet."
- Recent Runs (line 288): icon=PlayCircle, action="Create a run" → `/runs/new` (or omit if no project context), message="No recent runs."

### ISSUE 16 — useRecentItems hook: mount in Layout.tsx using useLocation (NEW — Run 3)
**File:** [web/src/hooks/useRecentItems.ts](web/src/hooks/useRecentItems.ts) (new file) + [web/src/components/Layout.tsx](web/src/components/Layout.tsx)
**Problem:** React Router v7 has no subscription event for navigation. A standalone hook cannot watch route changes. The hook must be consumed inside the router tree.
**Fix:** `useRecentItems` is a hook that uses `useLocation().pathname` in a `useEffect` to detect navigation. It is called **in Layout.tsx** (already the top-level router-tree component). It writes to `localStorage` key `tcms-recent:v1`. Each item stores `{ id, type: "case"|"run", title, projectName, url: pathname, visitedAt: ISOString }`. Max 10 items, newest first. Hook also exports the stored list for the sidebar.

### ISSUE 17 — Recent items: store full URL path, not just ID (NEW — Run 3)
**File:** [web/src/hooks/useRecentItems.ts](web/src/hooks/useRecentItems.ts) (new file)
**Problem:** If only `id` is stored, reconstructing the navigation URL requires knowing suiteId, sectionId, etc. — context that may not be available in the sidebar. 
**Fix:** Store `url: window.location.pathname` at write time. Navigation from sidebar is `navigate(item.url)`. No URL reconstruction needed.

### ISSUE 18 — Score snapshot: fire-and-forget + reuse existing run lookup (NEW — Run 3)
**File:** [api/src/routes/results.ts](api/src/routes/results.ts) (existing)
**Problem:** Snapshot trigger requires knowing `run.milestoneId`. The results route must look up run → milestoneId. This must be fire-and-forget (snapshot failure must not block result write).
**Fix:** In `POST /api/results`, after fetching the run for ownership verification (already needed), check `if (run.milestoneId)` then call the snapshot logic directly (not via HTTP — reuse the DB insert logic inline or extract to a shared function). Wrap in `try/catch` that only logs on failure. Result write commits regardless of snapshot outcome.

### ISSUE 19 — Global search error state (NEW — Run 3)
**File:** [web/src/components/GlobalSearchBar.tsx](web/src/components/GlobalSearchBar.tsx) (new file)
**Problem:** Network error or 401 on `GET /api/search` shows blank results, indistinguishable from zero results. User with expired token thinks search is empty.
**Fix:** Track `searchError` state separately from `searchResults`. If fetch throws, render "Search unavailable. Try again." in `text-error` class. Differentiate from zero results ("No cases or runs match '[query]'. Search looks in titles across all your projects.").

### ISSUE 20 — Project context after global search navigation (NEW — Run 3)
**File:** [web/src/components/GlobalSearchBar.tsx](web/src/components/GlobalSearchBar.tsx) (new file)
**Problem:** Clicking a search result navigates to a case or run page. If the user's active project in `ProjectContext` doesn't match the result's project, sidebar nav shows the wrong project.
**Fix:** Before calling `navigate(url)`, call `setProjectId(result.projectId)` from `ProjectContext`. Same pattern as the project switcher in the sidebar.

---

### ISSUE 21 — milestoneScores table must be defined in schema.ts before migration (NEW — Run 3 Eng)
**File:** [api/src/db/schema.ts](api/src/db/schema.ts)
**Problem:** `milestoneScores` not present in schema.ts — Drizzle Kit cannot generate migration without it. Implementing the snapshot endpoint without the schema definition first will block or force manually-written SQL (forbidden by CLAUDE.md).
**Fix:** Add to `api/src/db/schema.ts`:
```ts
export const milestoneScores = pgTable("milestone_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  milestoneId: uuid("milestone_id").notNull().references(() => milestones.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});
```
Then `npx drizzle-kit generate`. This is the **first implementation step** before any other Story 15.3 work.

### ISSUE 22 — Score formula: `score = passRate` (0–100 integer) (NEW — Run 3 Eng)
**File:** [api/src/routes/analytics.ts](api/src/routes/analytics.ts) (snapshot logic), [api/src/routes/milestones.ts](api/src/routes/milestones.ts) (new endpoint)
**Problem:** The readiness endpoint returns 7 fields, not a single `score`. The snapshot must store a scalar. Undefined formula = chart data meaningless across sprints.
**Fix:** `score = readinessData.passRate ?? 0`. Y-axis label: "Pass rate (%)". This matches the `ReadinessScore` component which already uses `passRate` as the primary metric.

### ISSUE 23 — Snapshot stampede: 1-minute cooldown guard (NEW — Run 3 Eng)
**File:** [api/src/routes/results.ts](api/src/routes/results.ts) (snapshot trigger)
**Problem:** A run with 500 test cases (seed data has 500+) triggers 500 concurrent snapshot writes, each requiring 5 readiness queries. 2,500 extra queries per bulk execution.
**Fix:** Before inserting, check: `SELECT 1 FROM milestone_scores WHERE milestone_id = $1 AND recorded_at > now() - interval '1 minute' LIMIT 1`. If row exists, skip insert. One guard query per result write vs. 5 readiness queries per snapshot.

### ISSUE 24 — useRecentItems must filter to entity URLs only (NEW — Run 3 Eng)
**File:** [web/src/hooks/useRecentItems.ts](web/src/hooks/useRecentItems.ts) (new file)
**Problem:** Without filtering, every `useLocation` pathname change (including `/dashboard`, `/projects/new`, `/reports`) gets recorded as a "recent item." The list will be full of navigation pages, not cases and runs.
**Fix:** Guard in the `useEffect`: `if (!/\/(cases|runs|milestones)\/[a-f0-9-]{36}/.test(pathname)) return;`. Only record paths matching case, run, or milestone entity routes.

### ISSUE 25 — GET /api/milestones/:id/scores endpoint must be specified (NEW — Run 3 Eng)
**File:** [api/src/routes/milestones.ts](api/src/routes/milestones.ts) (existing file)
**Problem:** The snapshot POST is specified, but the chart needs a GET endpoint to read history. Without this, `MilestoneProgress.tsx` has no data source for the chart.
**Fix:** Add `GET /api/milestones/:id/scores` → `SELECT id, score, recorded_at FROM milestone_scores WHERE milestone_id = $1 ORDER BY recorded_at ASC`. Returns `{ recordedAt: string; score: number }[]`. Auth: same `jwtVerify + assertProjectAccess` as all milestone routes. Add to `MilestoneProgress.tsx`: fetch this endpoint alongside existing progress fetch; pass to `LineChart`.

### ISSUE 26 — Recent items section must be in Workspace section, outside {projectId && ...} (NEW — Run 3 Eng)
**File:** [web/src/components/Layout.tsx](web/src/components/Layout.tsx) (existing file)
**Problem:** The sidebar's `{projectId && (...)}` block (line 94) hides content when no project is selected. Recent items must be visible regardless of project context — the whole point is jumping back to items in any project.
**Fix:** Place the Recent items section in the Workspace section (after line 242), NOT inside the `{projectId && (...)}` block. Render with the same `sectionLabel` class. Hidden entirely when `recentItems.length === 0`.

### ISSUE 28 — CasesOverview empty state: replace `<p>` with `<EmptyState variant="cta">` (NEW — Run 4)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** When no section is selected in the new three-panel layout, the center column renders `<p className="text-sm text-muted">Select a section in the tree to view its test cases.</p>`. This is the same bare-text pattern the sprint is explicitly fixing (ISSUE 10). The new primary page ships with the problem the sprint is solving.
**Fix:** Replace with `<EmptyState variant="cta" icon={<FolderOpen className="h-8 w-8 text-muted" />} action={null} message="Select a section from the tree to view test cases." />`. When a section IS selected but has zero cases, render: `<EmptyState variant="cta" icon={<PlusCircle />} action={<Link to={`/sections/${selectedSectionId}/cases/new`}>+ Add first case</Link>} message="No cases in this section yet." />`.

### ISSUE 29 — Recent items: export `pushItem()` for panel-open tracking (NEW — Run 4)
**File:** [web/src/hooks/useRecentItems.ts](web/src/hooks/useRecentItems.ts) (new file, from ISSUE 16)
**Problem:** `useRecentItems` tracks navigation via `useLocation().pathname` (ISSUE 16). But `CasesOverview` opens case detail in a slide-in panel — no URL change fires. Users who primarily navigate via the three-panel layout will have empty recent items for cases.
**Fix:** Add a `pushItem(item: RecentItem)` export to the hook alongside the `useLocation` effect. In `CasesOverview`, call `pushItem({ id: c.id, type: "case", title: c.title, projectName: currentProject?.name ?? "", url: `/cases/${c.id}/edit`, visitedAt: new Date().toISOString() })` when `setDetailPanelOpen(true)` is called. The hook's localStorage write and dedup logic apply to both paths.

### ISSUE 30 — CSS `*` transition rule: scope to interactive elements only (NEW — Run 4)
**File:** [web/src/index.css](web/src/index.css)
**Problem:** The global transition rule applies `transition-property: background-color, border-color, color; transition-duration: 200ms` to every element via `*`. On theme toggle, all 500+ case rows in CasesOverview animate simultaneously. On low-end devices this causes a visible frame drop.
**Fix:** Replace `* { transition-property: background-color, ... }` with `body, [data-theme], a, button, input, select, textarea, [class*="transition"] { transition-property: background-color, border-color, color; transition-duration: 200ms; }`. This preserves the smooth theme-toggle effect while excluding table elements.

### ISSUE 31 — CasesOverview `+ Add Case` routing: navigate back after creation (NEW — Run 4)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** The `+ Add Case` link at the breadcrumb bar routes to `/sections/${selectedSectionId}/cases/new` (CaseEditor). After saving, CaseEditor redirects to the edit page — not back to the three-panel overview. Users who add a case lose their context and must navigate back manually.
**Fix:** In the `Link` component, pass router state: `<Link to={`/sections/${selectedSectionId}/cases/new`} state={{ returnTo: "/cases/overview" }}>`. In `CaseEditor.tsx`, after successful save, read `location.state?.returnTo` and use it in the redirect: `navigate(location.state?.returnTo ?? `/cases/${newCase.id}/edit`)`. Same pattern used elsewhere in the codebase.

### ISSUE 32 — Section tree `w-60` + sidebar `w-52` = 448px left rail (NEW — Run 4 Design)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** Combined left-rail width is 448px. At 1024px viewport, table column gets ~576px minus the detail panel when open, shrinking to ~192px — insufficient for 7 columns with `min-w-[640px]`.
**Fix:** Narrow section tree to `w-48` (192px). Document `<!-- minimum supported viewport: 1200px -->` in the component JSX comment.

### ISSUE 33 — First-paint gate: blank table until section is selected (NEW — Run 4 Design)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** Default state (`selectedSectionId === null`) shows a prompt instead of data. Violates DESIGN.md "tables should feel like spreadsheets with taste" — a spreadsheet that shows nothing on load is not usable.
**Fix:** When `selectedSectionId === null`, show ALL cases in the table (current `filteredCases`). The "view all N cases" button behavior already handles this. Change the section tree click to a FILTER action, not a GATE. Section click = `setSelectedSectionId(id)` to narrow; clicking a selected section (or "All") = `setSelectedSectionId(null)` to show all.

### ISSUE 34 — Breadcrumb uses `font-mono` for navigation text (NEW — Run 4 Design)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** Line 765: `font-mono` on breadcrumb container. Suite/section names are semantic labels, not IDs. Contradicts DESIGN.md typography rules.
**Fix:** Remove `font-mono` from breadcrumb container `div`. The case count suffix (`"— N cases"`) can stay in mono via `<span className="font-mono ml-1">{visibleCases.length} case{…}</span>`.

### ISSUE 35 — Detail panel renders empty when `selectedCase` is null but panel is open (NEW — Run 4 Design)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** `{selectedCase && (...)}` conditional wraps the entire panel content including the close button. When case is deleted or project switches, `selectedCase` is null but `detailPanelOpen` stays true — panel appears open but empty with no way to close.
**Fix:** Render close button unconditionally when `detailPanelOpen` is true: move `<button onClick={() => setDetailPanelOpen(false)}>` outside the `{selectedCase && ...}` block. Show a skeleton/error state inside when `!selectedCase && detailPanelOpen`.

### ISSUE 36 — "No cases in section" shown even when filters are active (NEW — Run 4 Design)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** Empty state message says "No cases in this section." when filters have hidden all matching cases. User thinks the section is empty when it isn't.
**Fix:** Detect filter state: `const hasActiveFilters = !!(priorityFilter || statusFilter || caseTypeFilter || searchQuery)`. If empty AND filters active: "No cases match your filters." with the existing "Clear filters" button. If empty AND no filters: "No cases in this section." with the add-case CTA.

### ISSUE 37 — `fixed` detail panel covers sidebar nav (`z-40` > `z-30`) (NEW — Run 4 Design) ⚠️ KILL-SWITCH
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** Detail panel is `fixed right-0 top-12 z-40`. The outer sidebar in Layout.tsx is `z-30`. When the panel is open, it covers 384px of the right viewport — if the sidebar is on the left (208px), the panel does NOT cover it geometrically. BUT the panel escapes the `overflow-hidden` flex layout and covers whatever is in the right 384px of the viewport, including potentially the topbar controls or sidebar if viewport is narrow.
**Fix:** Use `absolute` positioning instead of `fixed`. Change the outer table column container to `relative overflow-hidden`. The panel then slides within the content area only: `absolute right-0 top-0 h-full w-96 ...`. This removes the z-index conflict entirely.

### ISSUE 38 — `--color-muted2` used but not defined in `index.css` (NEW — Run 4 Design) ⚠️ KILL-SWITCH
**File:** [web/src/index.css](web/src/index.css) + [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** `StatusDot` uses `"var(--color-muted2)"` for unset status. This token is in DESIGN.md but not in the updated `index.css`. Result: unset status dots render as transparent on every row.
**Fix:** Add to `:root, [data-theme="dark"]` block: `--color-muted2: oklch(0.312 0.018 268.0); /* #4A4A58 */`. Add to `[data-theme="light"]` block: `--color-muted2: oklch(0.688 0.018 268.0); /* #B0B0BF */`. Add to `@theme inline` block: `--color-muted2: var(--color-muted2);`.

### ISSUE 39 — `PriorityBadge` uses hardcoded hex `#D97B45` (semantic collision with Blocked amber) (NEW — Run 4 Design)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** `bg-[#D97B45]/10 text-[#D97B45] border-[#D97B45]/25` for "high" priority. DESIGN.md reserves amber for Blocked status only. Hardcoded hex bypasses ESLint token guard.
**Fix:** Add CSS token: `--color-priority-high: oklch(0.665 0.135 45.0); /* warm orange, distinct from blocked #E8A045 */` to `index.css`. Replace the hex classes with `bg-[var(--color-priority-high)]/10 text-[var(--color-priority-high)] border-[var(--color-priority-high)]/25`.

### ISSUE 40 — Three-panel layout collapses at < 1024px viewport (NEW — Run 4 Design)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** At 768px viewport, combined left rail + table `min-w` causes horizontal overflow hidden by `overflow-hidden`. Columns disappear silently.
**Fix:** Below `md:` breakpoint: hide the section tree panel; show a "Sections" toggle button that opens a sheet/drawer from the left. Table becomes full-width. Detail panel opens full-screen (100vw) instead of 384px. Add `hidden md:flex` to the section tree column.

### ISSUE 41 — Section tree nodes `<div onClick>` not keyboard navigable (NEW — Run 4 Design) ⚠️ KILL-SWITCH
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** `SectionTreeNode` outer `<div onClick>` is not focusable, not keyboard-navigable. WCAG 2.1.1 violation.
**Fix:** Change outer `<div>` in `SectionTreeNode` to `<button type="button">`. Add `role="treeitem"` and `aria-selected={isActive}`. Wrap the tree in `<div role="tree" aria-label="Section tree">`. The form inside (edit mode) should prevent event bubbling (`e.stopPropagation()`) — already done.

### ISSUE 42 — Table rows `<tr onClick>` not keyboard activatable (NEW — Run 4 Design) ⚠️ KILL-SWITCH
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** `<tr onClick>` opens detail panel but has no `tabIndex`, no `onKeyDown`, no `role`. Keyboard users cannot open the panel.
**Fix:** Add `tabIndex={0}` to each `<tr>`. Add `onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCaseId(c.id); setDetailPanelOpen(true); }}}`. Add `role="row"` (already implicit in `<tr>`, but explicit role helps AT).

### ISSUE 43 — Panel close does not return focus to triggering row (NEW — Run 4 Design)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** After closing the detail panel, focus is dropped. WCAG 2.4.3.
**Fix:** `const lastRowRef = useRef<HTMLTableRowElement | null>(null)`. In the row's `onClick`, set `lastRowRef.current = e.currentTarget`. In the close handler: `lastRowRef.current?.focus()`.

### ISSUE 44 — Detail panel missing `role` attribute (NEW — Run 4 Design)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** `aria-label="Case detail panel"` exists but no `role`. AT won't announce it as a landmark.
**Fix:** Add `role="complementary"` to the detail panel container.

### ISSUE 45 — `text-emerald-600` hardcoded in project list table (NEW — Run 4 Design)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** Line 466: `text-emerald-600` in the no-project-selected view. Hardcoded Tailwind palette class — violates design system rules.
**Fix:** Replace with `text-success`.

### ISSUE 46 — `StatusDot`, `PriorityBadge`, `SectionTreeNode` defined inside render function (NEW — Run 4 Design)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** All three sub-components are re-created every render. With 500+ rows, this compounds with the `*` transition rule (ISSUE 30) into visible sluggishness.
**Fix:** Hoist all three to module scope (outside `CasesOverview()`). Pass required props explicitly. This is a one-pass refactor.

### ISSUE 47 — Duplicate code block: no-project state appears twice (dead code at lines 603–657) (NEW — Run 4 Design) ⚠️ KILL-SWITCH
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** Lines 420–486 and 603–657 are identical early-return branches. The second copy at 603–657 is dead code (the first return at line 486 exits before it). Contains a `text-emerald-600` violation and confuses future editors.
**Fix:** Delete lines 603–657. Confirm the first copy (lines 420–486) is the active branch by verifying its position before any component definitions.

### ISSUE 48 — E2E page object stale: `CasesOverviewPage.ts` doesn't know about three-panel layout (NEW — Run 4 Eng) ⚠️ KILL-SWITCH
**File:** [e2e/pages/CasesOverviewPage.ts](e2e/pages/CasesOverviewPage.ts)
**Problem:** The Playwright page object was written for the old accordion/card layout. Selectors like `getByTestId('case-card')`, `getByRole('button', { name: suite.name })` don't exist in the new three-panel DOM. Every e2e spec that touches the cases overview will fail to find elements and either time out or produce false green (if selectors accidentally match).
**Fix:** Rewrite `CasesOverviewPage.ts` with selectors matching the new DOM: `[data-testid="section-tree"]`, `[data-testid="case-row"]`, `[data-testid="detail-panel"]`. Add `selectSection(id)`, `openCase(id)`, `getDetailPanel()` helpers. Update all callers in `e2e/specs/cases.spec.ts`.

### ISSUE 49 — `selectedCaseId` / `detailPanelOpen` not reset on project switch (NEW — Run 4 Eng)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** When the user switches projects via the sidebar, `selectedCaseId` and `detailPanelOpen` remain from the previous project. The detail panel slides in immediately showing a case from the old project until the next render cycle closes it. Visible flash; data integrity concern.
**Fix:** Add `useEffect(() => { setSelectedCaseId(null); setDetailPanelOpen(false); }, [projectId])`. Already have `projectId` from context.

### ISSUE 50 — `newSectionName` is a single string shared across all suite add-section forms (NEW — Run 4 Eng)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** `const [newSectionName, setNewSectionName] = useState('')` is one state var. If the user opens two "Add section" inline forms simultaneously (possible via keyboard), typing in one overwrites the other. The form renders per-suite but binds the same value.
**Fix:** Change to `const [newSectionName, setNewSectionName] = useState<Record<string, string>>({})`. Key by `suiteId`. Update all reads/writes: `newSectionName[suiteId] ?? ''`.

### ISSUE 51 — N+1 section fetches: every `setStatusFilter` call re-fetches sections (NEW — Run 4 Eng)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** `fetchSections()` is inside the effect whose dep array includes `statusFilter`. Changing the status filter dropdown triggers a full round-trip to `GET /api/projects/:id/suites-with-sections`, which returns the section tree (not filtered). This is ~200ms wasted per filter click. The section tree doesn't change based on status.
**Fix:** Split into two effects: one for sections (deps: `[projectId]`), one for cases (deps: `[projectId, statusFilter, selectedSectionId]`). Sections only reload on project change.

### ISSUE 52 — `summaryLoading` state is never read; summary is fetched twice on mount (NEW — Run 4 Eng)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** `summaryLoading` is set to `true`/`false` around the summary fetch but never used in JSX. Meanwhile the component fetches summary in two separate effects (once in the main data effect, once in a standalone effect). Users may see flickering counts.
**Fix:** Remove `summaryLoading` state. Consolidate summary fetch into the main data effect (after cases load). Delete the standalone summary effect.

### ISSUE 53 — "View all N cases" button is a no-op (NEW — Run 4 Eng)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** The status bar at the bottom renders a "View all N cases" button on click. The handler sets `setSelectedSectionId(null)` which should clear the section filter — but `visibleCases` is already showing all cases when `selectedSectionId` is null. The click does nothing visible; there's no navigation or modal triggered.
**Fix:** Either remove the button (the section tree already deselects on click to root), or make it actively clear `selectedSectionId` and scroll the table to top. Don't ship dead affordance.

### ISSUE 54 — `statusFilter` is applied server-side; all other filters are client-side — inconsistent behavior (NEW — Run 4 Eng)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** `statusFilter` is passed as a query param to `GET /api/projects/:id/cases?status=X`, so filtered cases are fetched fresh. But `searchQuery` and `selectedSectionId` filter `allCases` in `visibleCases` (client-side). If the user has 500+ cases, status filter fetches only the matching subset, then section + search filter that subset. Cross-filter combinations (status=passed + section=Login) give wrong counts in the status bar because the bar counts from `visibleCases`, not total.
**Fix:** Move all filtering client-side (fetch all cases once, filter in `visibleCases` memo) OR move all filtering server-side (pass section + search as query params). Mixing the two breaks count accuracy.

### ISSUE 55 — Dead state variables: `collapseAll`, `collapsedSections`, `showAddSection`, `addRootSection` (NEW — Run 4 Eng)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx)
**Problem:** Four state variables declared, never used in JSX or event handlers. Adds noise, inflates bundle, and confuses the reader into thinking collapse functionality exists.
**Fix:** Delete all four declarations and any associated `set*` calls.

### ISSUE 56 — `PATCH /api/results/:id` doesn't trigger milestone score snapshot (NEW — Run 4 Eng)
**File:** [api/src/routes/results.ts](api/src/routes/results.ts)
**Problem:** Story 15.3 requires a score snapshot row whenever a result is saved. The snapshot logic (planned for ISSUE 18) hooks into `POST /api/results`. But testers often edit an existing result via `PATCH`. The snapshot is never triggered on updates, so the score history graph will show gaps or flatline after the first save.
**Fix:** Extract snapshot trigger into `lib/milestoneScores.ts` helper. Call it from both `POST` and `PATCH` handlers after the result is persisted.

### ISSUE 57 — `assertTestAccess` is owner-only; team members can't write results, so score history stays empty (NEW — Run 4 Eng) ⚠️ KILL-SWITCH
**File:** [api/src/routes/results.ts](api/src/routes/results.ts) line ~31
**Problem:** `assertTestAccess` checks `p.userId === userId` — only the project owner passes. Team members (testers, leads) get 403 on `POST /api/results`. In practice, owners rarely run tests themselves. Story 15.3's score history graph will be empty for every real team because no results are ever written. This also breaks Story 12.4 (recent items after test execution).
**Fix:** Replace `assertTestAccess` with `assertProjectAccess(req, projectId)` (membership check) OR use `can(userId, projectId, "results.write")` from `lib/permissions.ts`. Both are already implemented.

### ISSUE 58 — `buildSectionTree()` duplicated in two files (NEW — Run 4 Eng)
**File:** [web/src/pages/cases/CasesOverview.tsx](web/src/pages/cases/CasesOverview.tsx) and [web/src/pages/cases/CasesDetails.tsx](web/src/pages/cases/CasesDetails.tsx)
**Problem:** Both files implement the same `buildSectionTree(sections, parentId)` recursive function independently. When the tree algorithm needs changing (e.g., for ISSUE 51's section refactor), the fix must be applied twice. They will inevitably diverge.
**Fix:** Extract to `web/src/lib/sectionTree.ts`. Import in both files. ~10-line extraction.

### ISSUE 59 — Snapshot insert crashes with NOT NULL constraint when `passRate` is null (NEW — Run 4 Eng) ⚠️ KILL-SWITCH
**File:** [api/src/routes/results.ts](api/src/routes/results.ts) (snapshot trigger, to be added)
**Problem:** When a run has zero results (empty run), `passRate` computes as `0/0 = NaN`, and after `Math.round()` becomes `NaN`. Drizzle inserts `null` for numeric columns when the value is `NaN`. The `milestone_scores` table has `pass_rate DECIMAL NOT NULL`. The insert crashes with `null value in column "pass_rate" violates not-null constraint`. The run that triggered the crash leaves no snapshot row, silently breaking the history graph for that milestone.
**Fix:** Guard before insert: `if (totalTests === 0) return;` — skip snapshot for empty runs. Alternatively default `passRate` to `0` when `totalTests === 0`.

### ISSUE 60 — `pushItem()` URL format must match `useLocation()` format — document the contract (NEW — Run 4 Eng)
**File:** [web/src/hooks/useRecentItems.ts](web/src/hooks/useRecentItems.ts) (new file)
**Problem:** `useLocation().pathname` returns `/projects/123/cases/456`. If callers pass `/cases/456` (without project prefix) to `pushItem()`, dedup (ISSUE 27 fix) will never match and duplicates will accumulate. Not a crash — a subtle data quality bug.
**Fix:** Add a JSDoc comment to `pushItem()` specifying the expected URL format: "Must be the full pathname as returned by `useLocation().pathname`, e.g., `/projects/{id}/cases/{id}`." Add an assertion in dev: `if (!url.startsWith('/projects/')) console.warn(...)`.

---

## GSTACK REVIEW REPORT

### Run 4 — 2026-05-14 (uncommitted — Story X.1 scope expansion) — IN REVIEW

| Review | Phase | Status | Findings | New ISSUES |
|--------|-------|--------|----------|-----------|
| CEO Review | Phase 1 | issues_open | 4 (2 kill-switch, 2 high) | ISSUES 28–29, 39–40 |
| Design Review | Phase 2 | issues_open | 10 (4 kill-switch, 4 high, 2 medium) | ISSUES 30, 37–47 |
| Eng Review | Phase 3 | issues_open | 13 (3 kill-switch, 6 high, 4 medium) | ISSUES 48–60 |
| Cross-phase themes | All | 3 themes | auth ownership (57), mixed filtering (54), dead code accumulation (55) | — |

**Kill-switch items (Run 4):** ISSUE 37 (panel z-index), ISSUE 38 (missing CSS token), ISSUE 41 (tree keyboard), ISSUE 42 (row keyboard), ISSUE 47 (dead code block), ISSUE 48 (stale e2e page object), ISSUE 57 (owner-only auth), ISSUE 59 (null passRate crash).
**Total kill-switch items across all runs:** ISSUES 1, 2, 7, 11 (Run 1–2) + ISSUES 21, 24, 25 (Run 3) + ISSUES 37, 38, 41, 42, 47, 48, 57, 59 (Run 4) = 15 total.
**Total ISSUES:** 60. **VERDICT:** PENDING FINAL APPROVAL GATE.

---

### Run 3 — 2026-04-17 (commit 8ce4768) [subagent-only] — APPROVED

| Review | Phase | Status | Findings | New ISSUES |
|--------|-------|--------|----------|-----------|
| CEO Review | Phase 1 | clean | 7 (all addressed) | 0 |
| Design Review | Phase 2 | issues_open | 12 (2 critical, 6 high, 4 medium) | 8 (ISSUES 13–20) |
| Eng Review | Phase 3 | issues_open | 17 (all mechanical) | 7 (ISSUES 21–27) |
| Cross-phase themes | All | 3 themes | spec ambiguity, auth pattern, chart 2-endpoint | — |

**Kill-switch items:** ISSUES 1, 2, 7, 11 (prior runs) + ISSUES 21, 24, 25 (Run 3).
**VERDICT:** APPROVED. 27 total ISSUES, all implementation specs. No blocking bugs.

---

### Run 1 — 2026-04-17 (commit ea1f5a0)

| Review | Phase | Status | Findings | Critical | High |
|--------|-------|--------|----------|---------|------|
| CEO Review | Phase 1 | clean | 6 (3 false positives due to stale backlog) | 0 | 1 (search commodity — taste) |
| Design Review | Phase 2 | issues_open | 7 | 0 | 4 |
| Eng Review | Phase 3 | issues_open | 10 (2 are plan clarifications) | 0 | 3 |
| Cross-phase | All | clean | 0 | — | — |

### Run 2 — 2026-04-17 (commit cfcadff) [subagent-only]

```
═══════════════════════════════════════════════════════════════
  CEO DUAL VOICES — CONSENSUS TABLE [subagent-only]
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                   YES*    N/A    [subagent-only]
  2. Right problem to solve?           PARTIAL N/A    [subagent-only]
  3. Scope calibration correct?        YES     N/A    [subagent-only]
  4. Alternatives sufficiently explored?YES    N/A    [subagent-only]
  5. Competitive/market risks covered? NO      N/A    [subagent-only]
  6. 6-month trajectory sound?         YES*    N/A    [subagent-only]
═══════════════════════════════════════════════════════════════
* Subagent flagged onboarding reframe (already deferred Decision 3) and
  competitor risk (table-stakes features). Both auto-decided: keep deferral,
  add Sprint G note. New finding: auth on snapshot endpoint (ISSUE 11).
```

```
═══════════════════════════════════════════════════════════════
  DESIGN LITMUS SCORECARD [subagent-only]
  Dimension                           Claude  Codex  Score
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Information hierarchy              5/10   N/A    5/10
  2. Missing states                     6/10   N/A    6/10
  3. User journey arc                   6/10   N/A    6/10
  4. Specificity of UI decisions        6/10   N/A    6/10
  5. Edge case handling                 5/10   N/A    5/10
  6. Accessibility                      7/10   N/A    7/10
  7. Trust / polish                     6/10   N/A    6/10
═══════════════════════════════════════════════════════════════
All existing 10 HIGH ISSUES confirmed valid. Design subagent added spec for
search zero-result copy: "No cases or runs match '[query]'. Search looks in
titles and descriptions across all your projects."
```

```
═══════════════════════════════════════════════════════════════
  ENG DUAL VOICES — CONSENSUS TABLE [subagent-only]
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Architecture sound?               YES     N/A    [subagent-only]
  2. Test coverage sufficient?         NO      N/A    [subagent-only]
  3. Performance risks addressed?      NO*     N/A    [subagent-only]
  4. Security threats covered?         NO*     N/A    [subagent-only]
  5. Error paths handled?              PARTIAL N/A    [subagent-only]
  6. Deployment risk manageable?       YES     N/A    [subagent-only]
═══════════════════════════════════════════════════════════════
* Performance: ILIKE full-table scan not addressed — ISSUE 12 added.
* Security: snapshot endpoint missing explicit auth guard — ISSUE 11 added.
```

**VERDICT (Run 2):** 12 HIGH ISSUES total (10 from Run 1 + 2 new: auth on snapshot, search pagination/index). All mechanical. No blocking bugs. Plan ready for implementation. ISSUES 1, 2, 7, 11 are the kill-switch items — if any of these four are missed during implementation, the sprint ships with either a broken chart, a security hole, or both.

---

### Run 3 — 2026-04-17 (commit 8ce4768) [subagent-only]

**Delta from Run 2:** 2 QA fixes (ISSUE-003: members endpoint owner injection; ISSUE-001: stats refresh after duplicate). Neither touches Sprint F target files. Plan scope unchanged.

**Primary Sprint F persona:** QA engineers who already use the product and need faster navigation (recent items, search) + team leads who need readiness visibility (score history). New-user activation is a secondary benefit via empty state CTAs.

**Sprint G differentiating feature candidate (Decision 15):** AI-assisted test generation (ANTHROPIC_API_KEY already in env, Haiku endpoints already built) extended to run-level coverage recommendations — "based on your changed files, these cases are uncovered." General-purpose tools (Notion, Linear) cannot replicate this.

**Why we win vs. general-purpose tools:** Dedicated execution analytics that no Notion table or GitHub Project can match — flaky test detection (flakinessScore), milestone readiness scoring with trend history, assignee tracking per test, run-level pass-rate charts. Sprint F solidifies the navigation layer; Sprint G turns the analytics depth into the acquisition hook.

**Recent items scope (explicit):** localStorage-only, max 10. Cross-device sync is out of scope for Sprint F. If demand is observed, a `userActivity` table + `GET /api/users/me/recent` endpoint can be added with minimal schema change in Sprint G.

**Guided onboarding (Decision 3 reasoning):** Quick Start modal was evaluated and deferred. Reason: empty-state CTAs deliver the same activation signal per page at zero modal-fatigue cost. A modal fires once; a CTA fires every time a user lands on a blank page. The implementation cost difference is also ~3x (modal = state, dismissal, animation, tutorial content; CTAs = 4 JSX edits).

**CEO DUAL VOICES — CONSENSUS TABLE (Run 3) [subagent-only]:**
```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                   YES     N/A    [subagent-only]
  2. Right problem to solve?           YES*    N/A    [subagent-only]
  3. Scope calibration correct?        YES     N/A    [subagent-only]
  4. Alternatives sufficiently explored?YES*   N/A    [subagent-only]
  5. Competitive/market risks covered? YES*    N/A    [subagent-only] (addressed above)
  6. 6-month trajectory sound?         YES     N/A    [subagent-only]
═══════════════════════════════════════════════════════════════
* Subagent raised persona clarification (mechanical, addressed), localStorage scope
  (mechanical, addressed), guided onboarding reasoning (mechanical, addressed).
  Finding 3 (score history low leverage) invalidated — 16 milestones in prod DB,
  feature has active users. Finding 6 (competitive risk) addressed with "why we win"
  paragraph above.
```

**VERDICT (Run 3):** 0 new HIGH ISSUES. All 7 CEO subagent findings auto-decided (mechanical or taste). Plan text updated with persona statement, Sprint G candidate, localStorage scope, "why we win" paragraph, and Decision 3 reasoning. Prior 12 HIGH ISSUES unchanged — all still valid kill-switch items. CEO phase: clean.

**Phase 2 transition.** Design subagent: 12 findings, 2 CRITICAL, 6 HIGH, 4 MEDIUM. All mechanical. 8 new ISSUES added (13–20). Design consensus:

**DESIGN LITMUS SCORECARD (Run 3) [subagent-only]:**
```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Score
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Information hierarchy (kill-switch buried)  4/10  N/A   4/10
  2. Missing states (error states unspecified)   4/10  N/A   4/10
  3. User journey arc                            6/10  N/A   6/10
  4. Specificity of UI decisions                 5/10  N/A   5/10
  5. Edge case handling                          5/10  N/A   5/10
  6. Accessibility                               7/10  N/A   7/10
  7. Trust / polish                              6/10  N/A   6/10
═══════════════════════════════════════════════════════════════
Scores improve with new ISSUES 13-20 applied. Key gaps: EmptyState API
(ISSUE 13), GlobalSearchBar modal spec (ISSUE 14), Dashboard 4-zone
coverage (ISSUE 15), useRecentItems mounting (ISSUE 16), fire-and-forget
snapshot (ISSUE 18). All mechanical.
```

**VERDICT (Phase 2):** 8 new HIGH/CRITICAL design issues (ISSUES 13-20). All mechanical auto-decisions (Decisions 22-27). 0 taste decisions. 0 user challenges. Design phase: issues_open (8 new, all implementation specs — no blocking bugs, all fixable during coding).

**Phase 3 transition.** Engineering subagent: 17 findings (3 Critical/High-pre-existing, 8 High, 6 Medium). 7 new ISSUES added (21–27). Architecture diagram:

```
Sprint F — Architecture Dependency Graph

NEW FILES:
  api/src/routes/search.ts  ──── GET /api/search?q=
      │  requires: users→projects (owned) + projectMembers (member)
      │  ILIKE: testCases.title, runs.name
      │  returns: {id,type,title,projectId,suiteId}
      │  auth: jwtVerify + project-scope filter [ISSUES 2,8,9,12]

  api/src/db/milestoneScores (schema.ts first!) ← ISSUE 21
      │  columns: id, milestoneId FK(cascade), score int, recordedAt
      ├─ write: POST /api/milestones/:id/score-snapshot [ISSUES 1,11,22,23]
      │    trigger: POST /api/results → r.milestoneId? → snapshot (fire-and-forget)
      │    cooldown: skip if snapshot in last 1 min [ISSUE 23]
      └─ read:  GET  /api/milestones/:id/scores [ISSUE 25]

  web/src/hooks/useRecentItems.ts
      │  useLocation (React Router) in Layout.tsx
      │  filter: /\/(cases|runs|milestones)\/[uuid]/ [ISSUE 24]
      │  store: {id,type,title,projectName,url,visitedAt} in localStorage:tcms-recent:v1
      │  dedup: skip if top item.url === pathname [ISSUE 27]
      └─ max 10, hidden when empty

  web/src/components/GlobalSearchBar.tsx
      │  trigger: header icon + Cmd/Ctrl+K [ISSUE 6,14]
      │  modal overlay: fixed inset-0, backdrop, Modal primitive
      │  fetch: GET /api/search?q= (debounced 250ms)
      │  on result click: setProjectId(result.projectId) → navigate(url) [ISSUE 20]
      └─ states: loading, results, zero-results, error [ISSUES 5,19]

MODIFIED FILES:
  api/src/routes/results.ts
      └─ after run fetch: if(r.milestoneId) → snapshot (uses already-fetched run row)
         NOTE: assertTestAccess still owner-only [ARCH-1 — pre-existing bug, do not propagate]

  web/src/components/ui/EmptyState.tsx
      └─ add variant="default"|"cta" prop + optional icon prop [ISSUE 13]
         "default": message → action (backward compat)
         "cta":     icon → action → message (onboarding pages)

  web/src/pages/Dashboard.tsx
      └─ 4 cards: Projects, Milestones, TestPlans, RecentRuns — all → EmptyState variant="cta" [ISSUE 15]

  web/src/pages/MilestoneProgress.tsx
      └─ fetch GET /api/milestones/:id/scores alongside existing progress
         LineChart: Y="Pass rate (%)", X="Date", tooltip="Score: {n} · {date}" [ISSUES 9,22,25]

  web/src/components/Layout.tsx
      └─ useRecentItems hook (entity-url filter, dedup)
         Recent sidebar section AFTER line 242 (Workspace section, outside projectId block) [ISSUE 26]
```

**ENG DUAL VOICES — CONSENSUS TABLE (Run 3) [subagent-only]:**
```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Architecture sound?               YES*    N/A    [subagent-only]
  2. Test coverage sufficient?         NO      N/A    [subagent-only]
  3. Performance risks addressed?      NO*     N/A    [subagent-only]
  4. Security threats covered?         NO*     N/A    [subagent-only]
  5. Error paths handled?              PARTIAL N/A    [subagent-only]
  6. Deployment risk manageable?       YES     N/A    [subagent-only]
═══════════════════════════════════════════════════════════════
* Architecture: sound with 7 conditions added (ISSUES 21-27).
* Performance: snapshot stampede (ISSUE 23), entity-URL filter (ISSUE 24).
* Security: assertTestAccess pre-existing bug; search cross-project auth (ISSUE 2) still kill-switch.
  Rate-limit deferred to Sprint G (fastify-rate-limit not installed).
```

**New kill-switch items (Run 3):** ISSUES 21 (schema before migration), 24 (entity URL filter — without it, recent items is broken from day one), 25 (GET scores endpoint — without it, chart has no data source), plus existing ISSUES 1, 2, 7, 11.

**Test plan artifact:** `~/.gstack/projects/vslvslv-tcms/development-test-plan-20260417-193332.md`

**VERDICT (Phase 3):** 7 new HIGH issues (ISSUES 21–27). All mechanical. Total: 27 ISSUES across 3 runs. 0 blocking bugs. Plan ready for implementation with all issues resolved. Kill-switch items: ISSUES 1, 2, 7, 11, 21, 24, 25.

---

### Cross-Phase Themes (Run 3)

**Theme 1: Specification ambiguity compounds across phases.** CEO found undocumented scope (localStorage, persona). Design found implementation ambiguities (EmptyState API, GlobalSearchBar modal). Eng found missing schema and endpoint. All three phases independently flagged that the plan described *what* but not *how* — each layer had to add specificity. This is the expected compression artifact of a plan written at story granularity. All resolved.

**Theme 2: Security boundaries on new endpoints.** Issues 2 (search project scope), 11 (snapshot auth), and ARCH-1 (assertTestAccess) all appeared across phases. The pattern: any new endpoint that crosses project boundaries or fires on mutations needs an explicit auth audit before implementation.

**Theme 3: The chart needs two endpoints.** Both Design (HIDDEN-5) and Eng independently flagged that the score chart requires a GET read endpoint in addition to the POST snapshot. Neither prior run caught this. High-confidence signal.

<!-- /autoplan restore point: /c/Users/C5414063/.gstack/projects/vslvslv-tcms/development-autoplan-restore-20260514-185317.md -->
