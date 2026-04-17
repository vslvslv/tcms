<!-- /autoplan restore point: /c/Users/C5414063/.gstack/projects/vslvslv-tcms/development-autoplan-restore-20260405-082848.md -->
# Sprint E Plan

Generated: 2026-04-05 | Branch: development | Commit: 83e9a13
Repo: vslvslv/tcms

## Context

Sprint D shipped v0.3.0.0: run tabs (Activity/Progress/Defects), Needs Attention page, milestone inline edit/delete, multi-suite cases overview, project settings redesign, sidebar navigation restructure. v0.3.0.1 added e2e cleanup hooks and adversarial fixes. Current status: `development` branch ahead of `main` by 3 commits (test infrastructure only).

Sprint E focuses on **test management completeness**: bulk case operations available project-wide, case duplication in context, test assignment within runs, and run view filtering by assignee.

---

## Sprint E Scope

### Story 1.7 — Bulk Operations on Cases (cross-section)
Bulk select + delete/move/copy across any cases visible in `CasesOverview.tsx`.
The API already exists: `POST /api/projects/:projectId/cases/bulk` (action: delete|move|copy, caseIds[], targetSectionId).
`SectionCases.tsx` already has a working bulk UI — but it only works within one section at a time.
**Work:** Add checkbox selection, toolbar with action picker + target section picker, and submit flow to `CasesOverview.tsx`.

### Story 1.8 — Case Duplication
Duplicate a test case (+ all its steps) with one click. API already exists: `POST /api/cases/:id/duplicate`.
**Work:** Add "Duplicate" button to the case row context menu in `CasesOverview.tsx` and in `SectionCases.tsx`.

### Story 2.10 — Assign Tests to Specific Users Within a Run
Allow a user to assign individual `tests` (case-in-run rows) to team members. Shows in run view with assignee avatar/name.
**Work:** DB migration (add `assigneeId uuid FK → users`), API PATCH endpoint (`PATCH /api/tests/:id` with `{ assigneeId }`), `GET /api/projects/:projectId/members` already exists for member list, UI assignment dropdown in `RunTestCaseSidebar.tsx`.

### Story 2.11 — Filter Tests in Run View (by status + assignee)
Status filter already exists in `RunView.tsx` (client-side, `statusFilter` state). Extend it to also filter by assignee.
**Work:** Add assignee filter dropdown (client-side, same pattern as status filter), persist filter state in URL query params so links are shareable.

---

## What Already Exists

| Sub-problem | Existing code |
|-------------|--------------|
| Bulk case API | `api/src/routes/cases.ts:682` — `POST /api/projects/:id/cases/bulk` |
| Duplicate case API | `api/src/routes/cases.ts:603` — `POST /api/cases/:id/duplicate` |
| Bulk UI (per-section) | `web/src/pages/SectionCases.tsx:22-106` — full checkbox + action + submit |
| Status filter in RunView | `web/src/pages/RunView.tsx:68-106` — `statusFilter` state + `filteredTests` memo |
| Bulk status update | `web/src/pages/RunView.tsx:159-175` — `applyBulkStatus()` |
| Project members list | `GET /api/projects/:id/members` — returns members with userId |
| Tests table | `api/src/db/schema.ts:296` — has `id`, `runId`, `testCaseId`, no `assigneeId` |
| RunTestCaseSidebar | `web/src/components/RunTestCaseSidebar.tsx` — per-test result recording sidebar |

---

## NOT in Scope

- Story 1.10 (drag-and-drop reorder) — needs dnd library, deferred
- Story 2.13 (execution timer) — no pressing user need, deferred
- Sprint D carry-forwards (Todo.tsx N+1, sidebar stale project name) — addressing in a follow-on micro-fix

---

## Implementation Order

1. **Migration** — add `assignee_id uuid` (nullable FK → users) to `tests` table via drizzle-kit generate + migrate
2. **API** — new `api/src/routes/tests.ts` with `PATCH /api/tests/:id { assigneeId }`. Register in `index.ts` alongside `results.ts`. **Also update `GET /api/runs/:id` response** to include `assigneeId` on each test row + add `assigneeId?: string` to `RunTest` type in `web/src/api.ts`. All three changes land together so Story 2.11's client-side filter has data to read.
3. **Story 1.8** — Duplicate button in `CasesOverview.tsx` row context menu + `SectionCases.tsx` row context menu (API already exists: `POST /api/cases/:id/duplicate`)
4. **Story 1.7** — Bulk selection state (`selectedIds: Set<string>`, `bulkAction`, `bulkTargetSection`) + toolbar + row checkboxes in `CasesOverview.tsx`. Use flat top-level state (not nested) to avoid re-render bugs given existing ~20 state declarations.
5. **Story 2.10** — Assignee dropdown in `RunTestCaseSidebar.tsx` (load members via `GET /api/projects/:id/members`, patch on change via `PATCH /api/tests/:id`)
6. **Story 2.11** — Assignee filter dropdown in `RunView.tsx`, extend `filteredTests` memo. URL param shape: `?status=X&assignee=Y` via `useSearchParams`.

### Known Tech Debt (not blocking this sprint)
- Bulk copy issues 3N DB round-trips for N cases (one INSERT per case inside transaction). Acceptable at typical volumes; revisit if users hit the 500-case ceiling.

---

## Success Criteria

- [x] User can select multiple cases across sections in CasesOverview and delete/move/copy them
- [x] User can duplicate a case from the case row (copy appears immediately below the original)
- [x] User can assign a run test to a team member from the sidebar
- [x] Run view filter works by status AND assignee, state reflected in URL
- [x] All stories covered by E2E tests in `test-design.spec.ts` and `test-execution.spec.ts`
- [ ] No regression in existing bulk/filter tests (pending e2e run)

---

## Dependencies

- Drizzle Kit available for migration generation
- Project members API returns userId (confirmed: `projectMembers` join on `users`)
- `PATCH /api/tests/:id` must land before any Story 2.10/2.11 UI work (no existing endpoint)
- `GET /api/runs/:id` response + `RunTest` TypeScript type must include `assigneeId` before Story 2.11 filter can work

---

## /autoplan Review — 2026-04-17

### Context
Post-implementation review. All 4 stories are substantially implemented in the `development` branch. Review ran 3 phases (CEO + Design + Eng), each with a Claude subagent for independent analysis. Codex unavailable (not installed) — single-model mode `[subagent-only]`.

### CEO DUAL VOICES — CONSENSUS TABLE [subagent-only]
```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                   YES     N/A    [subagent-only]
  2. Right problem to solve?           YES*    N/A    [subagent-only]
  3. Scope calibration correct?        PARTIAL N/A    [subagent-only]
  4. Alternatives sufficiently explored?NO     N/A    [subagent-only]
  5. Competitive/market risks covered? NO      N/A    [subagent-only]
  6. 6-month trajectory sound?         NO*     N/A    [subagent-only]
═══════════════════════════════════════════════════════════════
* Assignment model solves secondary workflow; primary (pre-run bulk assign) is missing.
* Auth defect in production is the 6-month regret scenario.
```

### DESIGN LITMUS SCORECARD [subagent-only]
```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Score
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Information hierarchy              6/10   N/A    6/10
  2. Missing states                     5/10   N/A    5/10
  3. User journey arc                   5/10   N/A    5/10
  4. Specificity of UI decisions        4/10   N/A    4/10
  5. Edge case handling                 4/10   N/A    4/10
  6. Accessibility                      6/10   N/A    6/10
  7. Trust / polish                     4/10   N/A    4/10
═══════════════════════════════════════════════════════════════
Overall design completeness: 5/10 — ships, but noticeably rough.
```

### ENG DUAL VOICES — CONSENSUS TABLE [subagent-only]
```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Architecture sound?               NO      N/A    [subagent-only]
  2. Test coverage sufficient?         NO      N/A    [subagent-only]
  3. Performance risks addressed?      PARTIAL N/A    [subagent-only]
  4. Security threats covered?         NO      N/A    [subagent-only]
  5. Error paths handled?              PARTIAL N/A    [subagent-only]
  6. Deployment risk manageable?       YES     N/A    [subagent-only]
═══════════════════════════════════════════════════════════════
```

---

## CRITICAL BUGS FOUND (fix before merge)

### BUG 1 — Auth: `assertTestAccess` blocks all project members (only owner can assign)
**File:** [api/src/routes/tests.ts:21](api/src/routes/tests.ts#L21)
**Problem:** `return !!p && p.userId === userId` — owner-only check. All non-owner team members get 404 on `PATCH /api/tests/:id`.
**Fix:** Replace with `return assertProjectAccess(db, s.projectId, userId)` — same pattern as `runs.ts:50`.
**Impact:** Test assignment feature non-functional for every non-owner user in a team.

### BUG 2 — UI: Assignee filter shows UUID slices, not names
**File:** [web/src/pages/RunView.tsx:326](web/src/pages/RunView.tsx#L326)
**Problem:** `label: t.assigneeId.slice(0, 8)` — truncated UUID shown as option text. `RunTest` type has no `assigneeName`.
**Fix:** Add `assigneeName?: string` to `RunTest` type + join `users` in `GET /api/runs/:id` response builder (runs.ts). Use in both filter and sidebar footer.
**Impact:** Filter is operationally useless; users see `"a3f8c1d0"` not a real name.

### BUG 3 — UI: Dead "Assign To" button with no onClick handler
**File:** [web/src/components/RunTestCaseSidebar.tsx:488](web/src/components/RunTestCaseSidebar.tsx#L488)
**Problem:** `<Button type="button" variant="secondary">Assign To</Button>` — no onClick, no handler. Sits adjacent to the real working assignee select.
**Fix:** Remove the button entirely. The `<label>Assignee</label>` + `<select>` is sufficient.
**Impact:** First thing users click does nothing. Makes assignment look broken.

---

## HIGH BUGS (fix before merge — functional)

### BUG 4 — API: `assigneeId` not validated against project membership
**File:** [api/src/routes/tests.ts:38](api/src/routes/tests.ts#L38)
**Fix:** Verify the target user is a project member before accepting the assignment.

### BUG 5 — E2E: Test assignment tests skip when no open run exists (no fixture creation)
**File:** [e2e/specs/test-execution.spec.ts:870](e2e/specs/test-execution.spec.ts#L870)
**Problem:** Tests skip when all runs are completed. No `createScratchRun` in `beforeAll`.
**Fix:** Follow the same pattern as all other Sprint E test groups — create a run in `beforeAll`, delete in `afterAll`.

### BUG 6 — API: `canAccessProject` in `projectAccess.ts` has broken multi-project membership query
**File:** [api/src/lib/projectAccess.ts:36](api/src/lib/projectAccess.ts#L36)
**Problem:** `db.select().from(projectMembers).where(eq(projectMembers.userId, userId))` fetches user's first membership globally, then checks `m.projectId === projectId` — wrong if user is in multiple projects.
**Fix:** Use `and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))` in a single query.

### BUG 7 — UI: Bulk ops target section picker shows flat names with no suite/hierarchy context
**File:** [web/src/pages/cases/CasesOverview.tsx:748](web/src/pages/cases/CasesOverview.tsx#L748)
**Fix:** Prefix section name with suite name: `Suite / Section`.

### BUG 8 — UI: No success confirmation after bulk move/copy completes
**File:** [web/src/pages/cases/CasesOverview.tsx:344](web/src/pages/cases/CasesOverview.tsx#L344)
**Fix:** Show inline success message using existing `bulkError` slot (e.g., "12 cases moved to Authentication").

### BUG 9 — UI: Duplicate button visually adjacent to Delete with identical styling
**File:** [web/src/pages/cases/CasesOverview.tsx:555](web/src/pages/cases/CasesOverview.tsx#L555)
**Fix:** Reorder row actions to: Edit | Delete | (gap) | Duplicate, or move Duplicate to secondary menu.

### BUG 10 — API: No audit log or webhook on test assignment
**File:** [api/src/routes/tests.ts:43](api/src/routes/tests.ts#L43)
**Fix:** Add `writeAuditLog(db, userId, "test.assigned", "test", updated.id, projectId)` + `dispatchWebhooks`.

---

## MEDIUM ISSUES (fix before merge — polish)

- Empty state message wrong when assignee filter active ([RunView.tsx:396](web/src/pages/RunView.tsx#L396))
- Assignee filter change doesn't clear bulk checkbox selection set ([RunView.tsx:319](web/src/pages/RunView.tsx#L319))
- Filter change closes open sidebar; should only close if selected test is filtered out ([RunView.tsx:319](web/src/pages/RunView.tsx#L319))
- No loading/error state for members fetch failure in sidebar ([RunTestCaseSidebar.tsx:137](web/src/components/RunTestCaseSidebar.tsx#L137))
- Migration `ADD COLUMN` has no idempotency guard (0016_little_valkyrie.sql:1)
- N+1 auth queries in `assertTestAccess` — collapse to a single join ([tests.ts:13](api/src/routes/tests.ts#L13))
- Run table "Assigned To" column always shows "—" even after assignment ([RunView.tsx:479](web/src/pages/RunView.tsx#L479))

---

## NOT IN SCOPE (deferred to TODOS.md)
- Select All across sections UX — medium improvement, not blocking
- Bulk assignment at run creation time (pre-run distribution) — see User Challenge below
- `runId` prop dead code in `RunTestCaseSidebar` — low cleanup item

---

## What Already Exists (mapped)
| Sub-problem | Code |
|---|---|
| assertProjectAccess (correct pattern) | `api/src/lib/projectAccess.ts` |
| assertRunAccess (model for fix) | `api/src/routes/runs.ts:53` |
| writeAuditLog | `api/src/lib/auditLog.ts` |
| dispatchWebhooks | `api/src/lib/webhooks.ts` |
| createScratchRun e2e helper | `e2e/specs/test-execution.spec.ts` |
| bulkError slot in CasesOverview | `web/src/pages/cases/CasesOverview.tsx:87` |

---

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|---------|
| 1 | CEO | Fix auth bug in tests.ts | Mechanical | P1+P4 | Critical functional defect; 2-line fix | No |
| 2 | CEO | Fix UUID label in filter | Mechanical | P1 | Feature unusable without real names | No |
| 3 | CEO | Remove dead "Assign To" button | Mechanical | P5 | Dead code is noise; remove it | No |
| 4 | CEO | Defer "Select All" UX | Taste | P3 | Useful but not blocking; deferred to TODOS | Implement now |
| 5 | Design | Fix empty state message for assignee filter | Mechanical | P5 | Wrong message misleads users | No |
| 6 | Design | Fix filter change closing sidebar | Mechanical | P5 | Only close if test is filtered out | No |
| 7 | Design | Fix bulk target section picker labels | Mechanical | P5 | Flat names ambiguous in multi-suite projects | No |
| 8 | Design | Fix no success feedback on bulk ops | Mechanical | P1 | Silent success is bad UX; use existing bulkError slot | No |
| 9 | Eng | Fix canAccessProject multi-project bug | Mechanical | P1 | Pre-existing defect in code path required by our fix | No |
| 10 | Eng | Add audit log + webhook on assignment | Mechanical | P2 | Standard pattern; every other mutation has it | No |
| 11 | Eng | Fix migration idempotency | Mechanical | P3 | Simple guard, prevents failed-deploy ops problem | No |
| 12 | Eng | Fix E2E fixture creation for Story 2.10/2.11 | Mechanical | P1 | Tests that always skip provide zero coverage | No |
| 13 | Eng | Optimize assertTestAccess to single join | Mechanical | P5 | 4 sequential queries → 1 join; in blast radius | No |

---

## GSTACK REVIEW REPORT

| Review | Phase | Status | Findings | Critical | High |
|--------|-------|--------|----------|---------|------|
| CEO Review | Phase 1 | issues_open | 10 | 2 | 5 |
| Design Review | Phase 2 | issues_open | 20 | 2 | 8 |
| Eng Review | Phase 3 | issues_open | 13 | 2 | 5 |
| Cross-phase | All | user_challenge | 1 | — | — |

**VERDICT:** NEEDS FIXES — 3 critical bugs (auth, UUID display, dead button) must be resolved before merge. 13 auto-decided fixes in the audit trail above. 1 user challenge outstanding (see gate below).
