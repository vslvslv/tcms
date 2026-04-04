<!-- /autoplan restore point: /c/Users/C5414063/.gstack/projects/vslvslv-tcms/sprint-03-04-26-1-autoplan-restore-20260404-140923.md -->
# Sprint C Plan

Generated: 2026-04-04 | Branch: sprint-03-04-26-1 | Commit: cb717ae
Repo: vslvslv/tcms

## Context

Sprint B shipped v0.1.0.1: case search, flaky badge, smart run UI, bulk status update, status filter.
Backlog audit (2026-04-04, Sprint B) showed 56% done (68/121), 8 partial, 45 not started.

**Pre-sprint code audit reveals stale BACKLOG entries:**
- 3.5 Attachment viewer: `AttachmentPanel.tsx` already renders in `TestCaseForm.tsx:714` + `RunTestCaseSidebar.tsx:419` — DONE
- 10.3 Case approval workflow: Approve/Revoke buttons in `TestCaseForm.tsx:478-484`, API at `cases.ts:332` — DONE
- 5.3 Shared step propagation: `sharedSteps.ts:102-111` already propagates `content` + `expected` to all referencing `testSteps` on PATCH — DONE (missing transaction wrap is a hotfix, not a feature)
- 3.5b Inline image preview: `AttachmentPanel.tsx:155-168` already renders inline thumbnails + lightbox for image content types — DONE

**True Sprint C gaps (after code audit):**

1. BACKLOG.md audit — mark 3.5, 10.3, 5.3, 3.5b as ✅
2. Transaction hotfix (5.3 adjacent) — wrap `sharedSteps.ts:97-111` two-update block in `db.transaction`
3. Transaction fix (pre-existing) — wrap `cases.ts:350` PATCH handler in `db.transaction`
4. Version restore (5.6) — restore a case to a previous version
5. **14.4 AI from CI failures** — generate test cases from CI failure logs or PRD descriptions (the product differentiator)

## Sprint C Scope (Approved)

### Task 0 — BACKLOG.md Audit
- Mark 3.5, 10.3, 5.3, 3.5b as ✅ with file references
- Effort: S (~10 min CC)

### Hotfix — sharedSteps Transaction (5.3-adjacent)
- Wrap `db.update(sharedSteps)` + `db.update(testSteps)` at `sharedSteps.ts:97-111` in a single `db.transaction(async (tx) => { ... })`
- Same fix for the DELETE path at `sharedSteps.ts:127-128` (detach + delete)
- Effort: XS (~5 min CC)

### Correctness Fix — cases.ts PATCH Transaction
- Wrap the entire mutation block at `cases.ts:350-394` in `db.transaction(async (tx) => { ... })`
- Covers: update testCases → delete testSteps → insert testSteps → delete caseFieldValues → insert caseFieldValues → insert caseVersions
- Prevents silent partial-write data loss on any step failure
- Effort: S (~10 min CC)

### Story 5.6 — Version Restore
- `POST /api/cases/:id/versions/:versionId/restore`
- Read snapshot from `caseVersions` row: `title`, `prerequisite`, `caseTypeId`, `priorityId`, `stepsSnapshot`
- In `db.transaction`: delete `testSteps` → insert from `stepsSnapshot` with `sharedStepId: null` (strip FK — restore uses frozen snapshot content, not live shared step content) → update `testCases` fields → insert new `caseVersions` entry
- **Do NOT restore** `status`, `approvedById`, `customFields` — not versioned
- Authorization: `can(userId, projectId, "cases.edit")`
- Frontend: "Restore this version" button in `CaseVersionHistory.tsx` version list
- Effort: M (~40 min CC)

### Story 14.4 — AI Test Generation from CI Failures
- Accept CI failure log text (paste or file) + optionally a PRD/ticket description
- Call Claude to analyze failure context and suggest relevant test case titles + steps
- Return structured suggestions (title, steps[]) for the user to accept/edit/insert into a suite
- API: `POST /api/projects/:projectId/generate-from-failure`
- Frontend: new "Generate from CI failure" panel (collapsible, similar to Smart Selection in CreateRunPage)
- Authorization: project membership (`assertProjectAccess`)
- Effort: L (~60 min CC)

## Scope Decisions

| # | Item | Decision | Reason |
|---|------|----------|--------|
| 0 | BACKLOG.md audit | INCLUDE | Ground truth — catches 4 more ✅ items |
| 1 | sharedSteps transaction hotfix | INCLUDE | Critical T1 — two-phase write without transaction |
| 2 | cases.ts PATCH transaction | INCLUDE | High T2 pre-existing — silent data loss on partial failure |
| 3 | Version restore (5.6) | INCLUDE | Natural completion of diff UI; solo-user recovery feature |
| 4 | AI from CI failures (14.4) | INCLUDE | The product thesis — 3 sprints shipped without advancing it |
| 5 | 3.5b inline image preview | MARK ✅ — already done | AttachmentPanel.tsx:155-168 already has thumbnails + lightbox |
| 6 | 5.3 propagation (feature) | MARK ✅ — already done | sharedSteps.ts:102-111 already propagates on PATCH |
| 7 | Assign tests to users (2.10) | DEFER Sprint D | Team feature; wrong persona for solo contractor; S1/S3/S4 eng blockers |
| 8 | Email notifications (11.1) | CUT | Depends on 2.10; runs table has no assignedTo field — incoherent trigger |
| 9 | Email notifications (11.2) | DEFER Sprint D | Wrong event semantics (fires on `approved` not `ready`); low SMTP adoption |
| 10 | Global search (12.1) | DEFER Sprint D | Sprint D after 14.4 validates AI angle |
| 11 | Saved filters (12.2-12.3) | DEFER Sprint D | Requires schema (saved_filters table) |

## Implementation Order

1. BACKLOG.md audit — ground truth first
2. sharedSteps.ts transaction hotfix — XS, correctness
3. cases.ts PATCH transaction fix — S, correctness
4. Version restore (5.6) — backend + small UI
5. AI from CI failures (14.4) — headline story, largest

## Total Estimated Effort

~1.5-2 hours CC. Human equivalent: 1 day.

## Dependencies

- 5.6: `caseVersions.stepsSnapshot` stores resolved content at snapshot time — restore inserts with `sharedStepId: null`
- 5.6: Version list capped at 50 (`cases.ts:428`); pagination not planned — document limitation in UI
- 14.4: Requires `ANTHROPIC_API_KEY` env var (already wired for 14.1-14.3)
- 14.4: Confirm existing AI generation prompt pattern from `api/src/routes/` (Sprint A)

## Success Criteria

- BACKLOG.md has ✅ for 3.5, 10.3, 5.3, 3.5b
- `sharedSteps.ts` PATCH and DELETE paths are atomic (single transaction)
- `cases.ts` PATCH is atomic (single transaction covers all sub-writes)
- "Restore this version" button in CaseVersionHistory restores title/prerequisite/steps to snapshot; does not touch status/approvedBy/customFields
- `POST /api/projects/:id/generate-from-failure` accepts failure log text, returns structured test case suggestions via Claude
- AI generation panel accessible from suite view or test case creation flow

---

## GSTACK REVIEW REPORT

Review date: 2026-04-04 | Branch: sprint-03-04-26-1

### Phase 1 — CEO Review (2 reviewers)

**CEO-1 (adversarial strategic assessment):**
- CRITICAL: AI thesis is being abandoned. 3 sprints shipped without advancing Epic 14. Product is drifting into being a worse TestRail.
- HIGH: 5.3 is a data integrity bug, not a feature — should be a hotfix.
- HIGH: Email (11.1/11.2) wrong bet for self-hosted contractor persona. SMTP adoption < 20%.
- HIGH: 2.10 test assignment is TestRail parity theater. Team feature for a solo-contractor tool.
- Recommended Sprint C: 5.3 hotfix + 14.4 AI from CI failures + 3.5b + 5.6 + 12.1. Cut 2.10 and email.

**CEO-2 (code-verified product review):**
- CRITICAL: 5.3 is ALREADY IMPLEMENTED at `sharedSteps.ts:102-111`. Plan narrative was wrong.
- CRITICAL: 3.5b is ALREADY IMPLEMENTED at `AttachmentPanel.tsx:155-168` with thumbnail + lightbox. Plan narrative was wrong.
- CUT 2.10: Team feature; no value for solo contractor.
- CUT 11.1: Depends on 2.10, cut with it.
- TASTE DECISION on 11.2: 15 lines if SMTP used; fire on `ready` transition not `approved`.
- KEEP 5.6: Natural completion of diff UI; genuine recovery feature.

**CEO consensus:** Remove 2.10 and email from Sprint C. Add 14.4 as headline story. Mark 5.3 and 3.5b as already done.

### Phase 2 — Design Review

Design subagent in progress. Key UI scope for Sprint C (post-cuts):
- 5.6: "Restore this version" button in CaseVersionHistory — no design system concerns
- 14.4: "Generate from CI failure" panel — model: Smart Selection collapsible panel in CreateRunPage

### Phase 3 — Engineering Review (2 reviewers)

**Eng-1:**
- T1 CRITICAL: `sharedSteps.ts:97-111` — two updates not in transaction. A crash between them leaves data inconsistent.
- T2 HIGH: `cases.ts:350` — entire PATCH is non-transactional. Silent data loss.
- T3 CRITICAL: Version restore must use `db.transaction` (plan says it but weak emphasis).
- S1 HIGH BLOCKER: `/api/projects/:id/members` requires `members.manage` — testers get 403 from assignee picker. Needs new `/assignable` endpoint.
- S2 MEDIUM: JWT in query string for image download leaks to logs/history.
- S3 HIGH: Assign endpoint doesn't validate target userId is a project member.
- A1 HIGH: Restoring with `sharedStepId` from snapshot will use current live content, not snapshot content. Fix: insert steps with `sharedStepId: null`.
- A2 HIGH: 11.1 email is incoherent — `runs` table has no `assignedTo` field.
- H4 HIGH: 11.2 email fires on `approved` not `ready` — wrong event semantics.

**Eng-2:**
- Confirms 5.3 already implemented at `sharedSteps.ts:102-111`.
- Confirms T1 (not transactional) and T2 (cases.ts PATCH).
- Confirms A1 (sharedStepId on restore): strip to null.
- Confirms S1 blocker for 2.10 (members endpoint permission).
- Confirms A2 and H4 (email trigger logic incoherent).
- 3.5b download endpoint only accepts Authorization header, not query param — additional backend work needed if JWT-in-URL approach used.

**Eng consensus:** Fix T1 and T2 as correctness hotfixes. Strip `sharedStepId` on restore. Deferred 2.10 and email have multiple unresolved blockers — correct to defer.

### Decision Audit Trail

| Decision | Rationale | Reviewer |
|----------|-----------|----------|
| Mark 5.3 as ✅ (already done) | Code at `sharedSteps.ts:102-111` already propagates | CEO-2, Eng-1, Eng-2 |
| Mark 3.5b as ✅ (already done) | `AttachmentPanel.tsx:155-168` already has thumbnails + lightbox | CEO-2 |
| Add db.transaction to sharedSteps | Critical T1 — two-phase write is non-atomic | Eng-1, Eng-2 |
| Add db.transaction to cases.ts PATCH | High T2 pre-existing — silent data loss | Eng-1, Eng-2 |
| DEFER 2.10 to Sprint D | Team feature + 4 eng blockers (S1/S3/S4/T-D) | CEO-1, CEO-2, Eng-1, Eng-2 |
| CUT 11.1 | Incoherent trigger (runs has no assignedTo) + depends on 2.10 | CEO-1, CEO-2, Eng-1, Eng-2 |
| DEFER 11.2 | Wrong event semantics + low SMTP adoption | CEO-1, CEO-2, Eng-1, Eng-2 |
| ADD 14.4 to Sprint C | Product thesis — 3 sprints shipped without AI advancement | CEO-1, User decision |
| Strip sharedStepId on restore | Restoring with FK uses live content, not snapshot content | Eng-1, Eng-2 |
| DEFER 12.1 global search | Post-14.4 Sprint D | CEO-1 (Sprint D), User decision |
