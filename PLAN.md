<!-- /autoplan restore point: /c/Users/C5414063/.gstack/projects/vslvslv-tcms/sprint-03-04-26-1-autoplan-restore-20260404-103340.md -->
# Sprint B Plan

Generated: 2026-04-04 | Branch: sprint-03-04-26-1 | Commit: 5245ecd
Repo: vslvslv/tcms

## Context

Sprint A shipped v0.1.0.0: bulk case ops, case duplication, AI test generation, design quality infra.
Backlog says Sprint B targets: shared steps UI (5.2), case version history UI (5.4, 5.5), case search (1.9), Smart Test Selection (17.2-17.4), flaky badge (16.3).

Code audit (same approach as Sprint A) reveals most Sprint B items already implemented:
- 5.2 shared step insertion: `TestCaseForm.tsx:337-615` — picker + insert done
- 5.4 case version history: `CaseVersionHistory.tsx:75-160` — component embedded in TestCaseForm
- 5.5 version diff: `CaseVersionHistory.tsx:107-150` — diff UI done
- 17.2 changedFiles in CI import: `importResults.ts:212-241` — done
- 17.3 suggest-tests endpoint: `runs.ts:466-491` — done

**True Sprint B gaps:**
1. BACKLOG.md audit — mark implemented items ✅
2. Case search (1.9) — no API endpoint, no UI
3. Flaky badge in RunView (16.3) — flakinessScore not loaded in RunView
4. Smart run button UI (17.4) — endpoint exists, no frontend
5. Bulk update test status in run (2.9) — no endpoint, no UI
6. Filter tests by status in RunView (2.11) — client-side, no assignee dependency

## Sprint B Scope (Corrected)

### Task 0 — BACKLOG.md Audit
- Mark 5.2, 5.4, 5.5, 17.2, 17.3 as ✅ with file references
- Update Sprint B notes to reflect actual gaps
- Effort: S (~15 min CC)

### Story 1.9 — Case Search
- `GET /api/projects/:projectId/cases/search?q=&sectionId=` — search by title + step content
- Use `ILIKE '%q%'` (simple, no new infra). Add `tsvector` index later if performance demands it.
- Frontend: search bar at top of SuiteView (or global nav). Results: flat list with section breadcrumb, click → case detail.
- Files: new endpoint in `api/src/routes/cases.ts`, new component `web/src/pages/SuiteView.tsx` (search bar)
- Effort: M (~45 min CC)

### Story 16.3 — Flaky Badge in RunView
- Load `GET /api/projects/:projectId/flaky-tests` in RunView alongside existing run load
- For each test in the run, look up its caseId → flakinessScore
- If score > 3: render `<span className="...">Flaky</span>` badge next to case title in test list
- Files: `web/src/pages/RunView.tsx`
- Effort: S (~20 min CC)

### Story 17.4 — Smart Run Button UI
- "Smart run from changed files" button in CreateRun page or Run list
- Text input or textarea for comma-separated file paths
- Calls `GET /api/projects/:projectId/suggest-tests?changedFiles=...`
- Returns suggested test cases; user can create a run pre-scoped to those cases
- Files: `web/src/pages/CreateRun.tsx` (or `web/src/pages/cases/CreateRunPage.tsx`)
- Effort: S (~30 min CC)

### Story 2.9 — Bulk Update Test Status in Run
- `POST /api/runs/:runId/tests/bulk-status` — body: `{ testIds: string[], status: ResultStatus }`
- Inserts result records for each test (same as single result, but batch)
- Frontend: multi-select checkboxes in RunView test list (reuse Sprint A pattern from SuiteView bulk ops)
- Bulk status toolbar: "N selected" + status dropdown (passed/failed/blocked/skipped)
- Authorization: `assertProjectAccess` + `can(userId, projectId, "results.create")`
- Files: `api/src/routes/runs.ts` (or new `results.ts`), `web/src/pages/RunView.tsx`
- Effort: M (~45-60 min CC)

### Story 2.11 — Filter Tests in RunView by Status
- Client-side filter: status dropdown (all / passed / failed / blocked / skipped / untested)
- No API change needed — all tests are already loaded in RunView
- Filter updates `allTestsInOrder` derived state
- Files: `web/src/pages/RunView.tsx`
- Effort: S (~20 min CC)

## Scope Decisions

| # | Item | Decision | Reason |
|---|------|----------|--------|
| 1 | BACKLOG.md audit | INCLUDE | Same hygiene issue as Sprint A |
| 2 | Case search (1.9) | INCLUDE | High-value gap; `ILIKE` approach, no new infra |
| 3 | Flaky badge (16.3) | INCLUDE | Small; data already available from existing endpoint |
| 4 | Smart run UI (17.4) | INCLUDE | Backend done; UI is 30 min to unlock a power feature |
| 5 | Bulk run status (2.9) | INCLUDE | High value for QA contractor persona; mirrors 1.7 pattern |
| 6 | Filter by status (2.11) | INCLUDE | Client-side; zero backend; 20 min CC |
| 7 | Assign tests to users (2.10) | DEFER Sprint C | Needs schema migration (`assignedTo` column on `tests`) |
| 8 | Filter by assignee (2.11b) | DEFER with 2.10 | Depends on assignee column existing |
| 9 | Case search global (12.1) | DEFER Sprint C | Scope this sprint: project-scoped search only |

## Implementation Order

1. BACKLOG.md audit — ground truth first
2. Filter by status (2.11) — 20 min, pure client-side win
3. Flaky badge (16.3) — 20 min, data already exists
4. Case search (1.9) — API then UI
5. Smart run UI (17.4) — leverages existing endpoint
6. Bulk run status (2.9) — largest, most complex, save for last

## Total Estimated Effort

~3 hours CC. Human equivalent: 1.5-2 days.

## Dependencies

- 2.9 bulk run status: confirm `results.create` is the right permission action (check `lib/permissions.ts`)
- 1.9 case search: confirm SuiteView has projectId in context (it does via `ProjectContext`)
- 17.4 smart run: confirm CreateRun page file path

## Success Criteria

- BACKLOG.md has ✅ for 5.2, 5.4, 5.5, 17.2, 17.3
- `GET /api/projects/:id/cases/search?q=login` returns matching cases with section breadcrumb
- Search bar in SuiteView filters case list in real-time
- "Flaky" badge appears next to high-flakinessScore tests in RunView
- RunView has status filter dropdown; selecting "Failed" shows only failed tests
- "Smart run" button in CreateRun UI accepts changed file paths and suggests cases
- `POST /api/runs/:runId/tests/bulk-status` sets status for multiple tests in one call
- Checkboxes + bulk status toolbar in RunView, same UX pattern as case bulk ops

## Eng Review — Critical Corrections (Phase 3)

### Search Implementation Correction

**tsvector cross-table issue:** `testSteps` is a separate table from `testCases`. A GIN expression index cannot span two tables. Two viable approaches:

**Option A (recommended for MVP — pg_trgm on title):**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY test_cases_title_trgm_idx ON test_cases USING GIN (title gin_trgm_ops);
```
Query: `WHERE title ILIKE '%' || q || '%' AND project_id = :projectId`
Covers 95% of use case. Step content search is Sprint C.

**Option B (full tsvector with trigger — deferred to Sprint C):**
Add `search_vector tsvector` generated column to `testCases`, maintained by a PostgreSQL trigger that aggregates `title || steps.content`. Complex DDL — not MVP.

**Auto-decision:** Use Option A (pg_trgm). User confirmed tsvector in premise gate but the cross-table complexity was not apparent then. Surfaced as TASTE DECISION at final gate — user may override to "step content search, trigger approach."

### Bulk Status — Cross-Run testId Validation (SECURITY — CRITICAL)

`POST /api/runs/:runId/tests/bulk-status` MUST validate that all submitted `testIds` belong to the specified `runId` before the bulk INSERT. Without this, a user with access to run A can mutate tests from run B.

Implementation:
```typescript
// After assertRunAccess:
const belongCheck = await db
  .select({ id: tests.id })
  .from(tests)
  .where(and(inArray(tests.id, testIds), eq(tests.runId, runId)));
if (belongCheck.length !== testIds.length) {
  return replyError(reply, 400, "One or more testIds do not belong to this run", "VALIDATION_ERROR");
}
```

### Bulk Status — Batch INSERT

Use a single `db.insert(results).values([...])` for all testIds — NOT a loop. Same pattern as bulk copy in Sprint A. Up to 500 rows per call.

### Flaky Data Loading

Load `/api/projects/:id/flaky-tests` ONCE on RunView mount. Cache as `Map<caseId, flakinessScore>` in component state. O(1) lookup when rendering each test row. One API call total, not one per test.

### Search Component Extraction

Extract the search input + results panel + debounce + keyboard nav as `<CaseSearchBar>` in `web/src/components/CaseSearchBar.tsx`. SuiteView imports and renders it. This is ~150 lines of stateful combobox logic that doesn't belong inline in SuiteView. Reuse `useDebounce` hook if it exists, or create it.

### NOT in Scope

| Item | Reason |
|------|--------|
| Step content search (tsvector trigger) | Cross-table tsvector requires trigger — deferred Sprint C |
| Assign tests to users (2.10) | Schema migration needed — Sprint C |
| Notification on run completion | Epic 11 deferred |
| pg_trgm fuzzy search variants | pg_trgm GIN covers ILIKE; fuzzy variants deferred |

### What Already Exists

| Sub-problem | File | How to reuse |
|-------------|------|-------------|
| assertRunAccess helper | `runs.ts:52` | Import for bulk status route |
| Bulk insert pattern | `routes/cases.ts` (bulk copy) | Follow same pattern for result INSERT |
| FlakyTests API | `analytics.ts:30` | Load once, cache as Map |
| suggest-tests API | `runs.ts:466` | Frontend calls, already done |
| RunView keyboard shortcuts | `RunView.tsx:84-127` | Understand before adding new keyboard handlers |
| Status filter state | `allTestsInOrder` in `RunView.tsx:83` | Derived state — filter applies here |

- `GET /api/projects/:projectId/cases/search`: call `assertProjectAccess(request, projectId)`
- `POST /api/runs/:runId/tests/bulk-status`: use existing `assertRunAccess(db, runId, userId)` helper at `runs.ts:52` — it traces runId → suiteId → projectId. Do NOT create a new auth lookup.
- `testIds.length === 0` → 400 before DB query
- `testIds.length > 500` → 400 with message "Maximum 500 tests per bulk operation"
- Audit log for bulk status: `{ action: "bulk-status-update", runId, count, status }` via `lib/auditLog.ts`

## Search Implementation (from CEO Review — tsvector approach)

- Add migration: computed `tsvector` expression index on `testCases(title, steps)` — or store as generated column
- `GET /api/projects/:projectId/cases/search?q=&sectionId=` — query using `to_tsquery` / `websearch_to_tsquery`
- Include section breadcrumb in response: `sectionPath: string[]` (section names from root to leaf)
- Debounce on frontend: 250ms keypress delay before firing API call
- Loading state: spinner during search; empty state: "No test cases match '{q}'"

## Design Spec (from Phase 2 Design Review)

### Case Search Bar (1.9)

**Placement:** Persistent search bar at the top of SuiteView, full-width, above the section tree. Always visible (not hidden behind a button).

**Behavior:** Search-as-you-type with 250ms debounce → API call → results replace section tree. Clear (X button) restores section tree.

**Result row layout:**
```
[magnifier icon] [case title]
                 [section breadcrumb — "Suite > Section > Subsection" in text-muted text-xs]
```

Click → navigate to case detail. Back button returns to search results (not full tree reset).

**Input component:** Reuse `Input.tsx` + left-side magnifier icon (SVG inline or Lucide `Search`).

**Keyboard nav:** `↓/↑` to move through results, `Enter` to navigate, `Escape` to clear and restore tree.

**Accessibility:** `role="search"` on the form, `aria-label="Search test cases"`, results list `role="listbox"`, each result `role="option"`.

**States:**
- Loading: spinner in right side of input
- Empty (no match): "No cases match '{q}'" centered in results panel + "Clear search" link
- Error: silent fail (log error, tree visible)
- No query: section tree shown normally

**Results panel:** `bg-surface border border-border rounded-md shadow-md` directly below input, max-height 400px, scroll within panel.

### Flaky Badge (16.3)

**Visual:** `bg-warning/15 text-warning text-xs font-medium px-1.5 py-0.5 rounded border border-warning/30`

**Placement:** Right of case title text, before the status pill, in the test list row.

**Tooltip:** `title="Flakiness score: {score}/10"` (native HTML title attribute — no custom tooltip component needed for MVP).

**Threshold:** Score > 3 (matches existing backend logic in `analytics.ts:76`).

### Smart Run UI (17.4)

**Placement:** Collapsible section at the top of CreateRun form, labeled "Smart selection (optional)". Collapsed by default.

**Input:** Textarea: label "Changed file paths (one per line)", placeholder `e.g. src/auth/login.ts`. "Find tests" button (primary, disabled until textarea non-empty).

**Results state:** Checklist of suggested cases after API response. Each row: checkbox + case title + section breadcrumb + "N runs correlated" count in `text-muted text-xs`.

**States:**
- Loading: spinner + "Finding related tests..."
- Empty: "No test suggestions — run CI with file tracking to build correlation data. [Learn more]"
- Error: "Smart selection unavailable right now."
- Results: Checklist visible; user can deselect individual cases before creating run.

**Integration with CreateRun:** Confirmed cases pre-check the case selection step in the existing run creation form.

### Bulk Status Toolbar in RunView (2.9)

**Behavior:** Contextual overlay bar that REPLACES the filter row (2.11) when ≥1 tests are selected. Reverts to filter row on deselect. Mirrors SuiteView bulk ops pattern from Sprint A exactly.

**Toolbar contents:** "[N selected]" counter + "Set status:" label + status dropdown (passed/failed/blocked/skipped/untested) + "Apply" button + "Deselect all" link.

**On mobile:** Counter + icon-only actions (no text labels on buttons).

**Keyboard:** Accessible checkboxes (`<input type="checkbox">`), status dropdown `aria-label="Set status for {N} selected tests"`.

**States:**
- Loading: spinner on Apply button, dropdown disabled
- Success: toast "Updated {N} tests to {status}"
- Error: toast "Failed to update {N} tests" (retry button in toast)

### Status Filter in RunView (2.11)

**Placement:** Persistent filter row above test list (hidden by bulk status toolbar when selections are active).

**Control:** `<select aria-label="Filter by status">` with options: All, Passed, Failed, Blocked, Skipped, Untested.

**Empty state:** "No {status} tests in this run" centered in the test list area + "Clear filter" link.

**Implementation note:** Client-side derived state from `allTestsInOrder` — no API changes.

### Design System Tokens (all new UI)

Zero hardcoded Tailwind palette classes (enforced by ESLint). Use only:
- `bg-surface`, `bg-surface-raised`, `bg-primary`, `bg-destructive`, `bg-warning/15`
- `text-primary`, `text-muted`, `text-primary-foreground`, `text-warning`
- `border-border`, `border-warning/30`
- `shadow-md` (for search results panel)
- `rounded`, `rounded-md` (not `rounded-full` except for pill badges)

## Failure Modes Registry

| # | Failure | Severity | Detection | Recovery |
|---|---------|----------|-----------|----------|
| FM1 | pg_trgm extension not installed on prod DB | High | Migration fails | Use `CREATE EXTENSION IF NOT EXISTS pg_trgm` |
| FM2 | testIds cross-run attack | Critical | belongCheck query rejects mismatched IDs | assertRunAccess + IN check |
| FM3 | Search returns results from wrong project | Critical | assertProjectAccess + WHERE project_id | Project scoping in WHERE clause |
| FM4 | Flaky API unavailable on RunView | Low | Badge hidden (no error shown) | Silent fallback |
| FM5 | Bulk status concurrent updates to same test | Low | Latest result wins (append model) | Consistent with existing behavior |
| FM6 | ILIKE full scan at 50k+ cases | Medium | Slow query | pg_trgm GIN index (in plan) |

## Test Plan

Full test plan artifact: `~/.gstack/projects/vslvslv-tcms/C5414063-sprint-03-04-26-1-test-plan-20260404-104329.md` (24 tests: 5 critical, 10 high, 8 medium, 1 low)

| Test | File | Type | Priority |
|------|------|------|---------|
| Search — happy path (title match) | `api/test/cases-search.test.ts` | Integration | Critical |
| Search — unauthorized → 403 | `api/test/cases-search.test.ts` | Integration | Critical |
| Bulk status — happy path | `api/test/runs-bulk-status.test.ts` | Integration | Critical |
| Bulk status — cross-run testIds → 400 | `api/test/runs-bulk-status.test.ts` | Integration | Critical |
| Bulk status — unauthorized → 403 | `api/test/runs-bulk-status.test.ts` | Integration | Critical |
| Bulk status — empty testIds → 400 | `api/test/runs-bulk-status.test.ts` | Integration | High |
| Bulk status — audit log written | `api/test/runs-bulk-status.test.ts` | Integration | High |
| FlakyBadge — renders score > 3 | `web/src/components/FlakyBadge.test.tsx` | Unit | High |
| FlakyBadge — hidden score ≤ 3 | `web/src/components/FlakyBadge.test.tsx` | Unit | High |
| Search — SQL injection chars in q | `api/test/cases-search.test.ts` | Integration | High |
| CaseSearchBar — keyboard nav | `web/src/components/CaseSearchBar.test.tsx` | Unit | High |
| RunView filter — shows only failed | `web/src/pages/RunView.test.tsx` | Unit | High |
| RunView filter — empty state | `web/src/pages/RunView.test.tsx` | Unit | Medium |
| Smart run — suggestions render | `e2e/specs/smart-run.spec.ts` | E2E | High |

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|---------|
| 1 | Phase 0 | Create PLAN.md from backlog Sprint B items | MECHANICAL | P6 action | No plan file existed; backlog is the source of truth | Start from stale CEO plan |
| 2 | CEO/0A | Code audit first — most "Sprint B" items already done | MECHANICAL | Accuracy | Same pattern as Sprint A; backlog showed stale ❌ entries | Trust backlog |
| 3 | CEO/0C-bis | Choose Approach B (tsvector) over A (ILIKE) | TASTE DECISION | P1+P2 | tsvector indexes step content; however cross-table requires trigger — surfaced at gate | ILIKE only |
| 4 | CEO/expand | Include search result section breadcrumb | MECHANICAL | P1 completeness | Without it, flat result list is confusing | Skip |
| 5 | CEO/expand | Include search debounce (250ms) | MECHANICAL | P1 correctness | Without debounce, every keypress fires DB query | Skip |
| 6 | CEO/expand | scroll-to-top on filter change | MECHANICAL | P2 in blast radius | 3-line UX fix, RunView already touched | Skip |
| 7 | CEO/expand | Smart run: show correlation count | MECHANICAL | P2 in blast radius | Backend already returns it; 5-line UI addition | Skip |
| 8 | CEO/subagent | interoperability-first concern | USER CHALLENGE | — | Subagent suggests TestRail import before search; /office-hours deferred it — surfaced at gate | — |
| 9 | CEO/subagent | 2.10 vs 16.3 swap | TASTE DECISION | — | Subagent says assign tests > flaky badge; 2.10 requires schema migration — surfaced at gate | — |
| 10 | CEO/subagent | AI pipeline differentiation (17.4 to AI gen) | TASTE DECISION | — | Connect changed files → suggest → generate as pipeline | Keep 17.4 as-is |
| 11 | Design/P1 | Search results: inline panel replaces tree (not dropdown) | MECHANICAL | P5 explicit | Subagent: dropdown or inline was ambiguous | Floating dropdown |
| 12 | Design/P2 | Full interaction state table | MECHANICAL | P1 completeness | Zero states defined in original plan | Skip |
| 13 | Design/P3 | Smart run: collapsible + checklist (not free-text only) | MECHANICAL | P5 explicit | Subagent: what happens after suggestions was undefined | Free-text only |
| 14 | Design/P5 | Token classes specified for all new UI | MECHANICAL | P1+P5 | Prior sprint had 41 hardcoded escapes | Skip |
| 15 | Design/P6 | Mobile: bulk toolbar icon-only | MECHANICAL | P3 pragmatic | RunView cramped on mobile; matches Sprint A approach | Same as desktop |
| 16 | Design/P7 | Accessibility spec for all new interactive elements | MECHANICAL | P1 completeness | No keyboard/ARIA spec in original plan | Skip |
| 17 | Eng/arch | testIds cross-run validation (SECURITY CRITICAL) | MECHANICAL | P1 security | Both models agree: cross-run mutation possible without check | Skip |
| 18 | Eng/arch | CREATE INDEX CONCURRENTLY for pg_trgm | MECHANICAL | P1 production safety | Avoids table lock during migration | Regular CREATE INDEX |
| 19 | Eng/arch | Extract FlakyBadge + CaseSearchBar as components | MECHANICAL | P5 explicit | RunView already 383 lines; combobox logic is ~150 lines | Inline |
| 20 | Eng/code | Reuse assertRunAccess (not inline lookup) | MECHANICAL | P4 DRY | Helper already exists at runs.ts:52 | Copy inline |
| 21 | Eng/code | useDebounce hook (not inline) | MECHANICAL | P5 explicit | 150-line combobox logic; reusable | Inline |
| 22 | Eng/code | tsvector cross-table: reclassify to TASTE DECISION | TASTE DECISION | — | Step-content tsvector requires trigger; pg_trgm covers 95% | — |
| 23 | Eng/perf | Batch INSERT for bulk status (not loop) | MECHANICAL | P5 explicit | Same pattern as Sprint A bulk ops | Per-row loop |
| 24 | Eng/perf | Flaky data: one API call, Map lookup | MECHANICAL | P3 pragmatic | One call vs N calls per test row | Per-test call |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/autoplan` Phase 1 | Scope & strategy | 1 | ✅ PASS | 7 findings — 5 auto-approved, 2 subagent USER CHALLENGES at gate |
| Outside Voice | Claude subagent (CEO mode) | Independent strategic challenge | 1 | ⚠ ISSUES | 5 concerns — 3 surfaced at gate |
| Design Review | `/autoplan` Phase 2 | UI/UX gaps | 1 | ✅ PASS | 6 findings — all resolved in spec (all auto-decided) |
| Design Voice | Claude subagent (design mode) | Independent design review | 1 | ⚠ ISSUES | 5 findings — all resolved |
| Eng Review | `/autoplan` Phase 3 | Architecture, tests, security | 1 | ✅ PASS | 7 findings — 1 critical (cross-run testIds, resolved), 3 high, 3 medium |
| Codex Review | `/codex exec` | Independent 2nd opinion | 0 | ⚠ SKIPPED | codex not installed |

**VERDICT:** REVIEWED — 3 phases complete. 24 decisions logged. 3 taste decisions + 2 user challenges surfaced at gate. 1 critical security finding resolved (cross-run testIds). Ready for user approval.

**Test plan:** `~/.gstack/projects/vslvslv-tcms/C5414063-sprint-03-04-26-1-test-plan-20260404-104329.md` (24 tests: 5 critical, 10 high, 8 medium)