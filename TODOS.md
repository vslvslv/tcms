# TODOS.md — Deferred from autoplan reviews

Generated: 2026-04-03 | Branch: re-design-application | Autoplan run

---

## From re-design-application review (2026-04-03)

### Deferred to future sprint

| Item | Priority | Source | Notes |
|------|----------|--------|-------|
| Visual regression baseline (Storybook or Playwright snapshots) | Medium | Eng review | No way to catch per-component regressions at present |
| Responsive layout (mobile/tablet) | Medium | Design review | Sidebar assumes desktop; any tablet user breaks |
| Full WCAG 2.1 AA audit (axe-core automation) | Medium | Both reviews | Systematic tooling sprint; current: borderline muted contrast |
| `<link rel="preconnect">` for Google Fonts | Low | Eng review | ~100ms DNS+TLS first-load cost |
| shadcn/ui migration | Low | CEO review | Ocean — not worth disrupting working system |
| Token-to-utility mapping comment in index.css | Low | Eng review | New contributor clarity for @theme inline |
| Empty state → page mapping documentation | Low | Design review | Which pages use skeleton vs spinner |
| Sidebar nav structure documentation | Low | Design review | Document active-state token, grouping, collapsible behavior |

### Ship blockers resolved before this entry (tracked separately)
- localStorage crash in ThemeContext.tsx — must be fixed before merge
- OAuth button bg-white invisible in light mode (Login.tsx:101) — must be fixed before merge
- ~41 hardcoded Tailwind escapes across 13 files — fix before merge (DatasetEditor worst offender)
- Button.tsx missing focus ring — fix before merge

---

## From previous sprints (BACKLOG ❌ items)

See BACKLOG.md for full list. High-value deferred items:
- ~~1.7: Bulk operations on cases (move, copy, delete)~~ **Completed: v0.1.0.0 (2026-04-04)**
- ~~1.9: Case search / full-text filter~~ **Completed: v0.1.0.1 (2026-04-04)**
- ~~2.9: Bulk update test status within a run~~ **Completed: v0.1.0.1 (2026-04-04)**
- 3.1-3.5: File attachments (full Epic 3 — schema exists, no API/UI)
- ~~Epic 14: AI test generation~~ **Completed: v0.1.0.0 (2026-04-04)**
- Epics 15-17: release readiness score (done), flaky test detection (done), smart test selection (deferred)

---

## From Sprint A autoplan review (2026-04-04, sprint-03-04-26-1)

| Item | Priority | Source | Notes |
|------|----------|--------|-------|
| ~~Case search 1.9 (PostgreSQL FTS)~~ | High | Eng review — no new infra needed | **Completed: v0.1.0.1 — `GET /api/projects/:id/cases/search?q=` + `<CaseSearchBar>`** |
| AI generation specificity — angle from CI failures or PRDs | High | CEO subagent review | Generic "generate from suite context" is table-stakes. Differentiating angle: generate from recent failing test patterns or feature description. Deferred for Epic 14 v2 after MVP validates. |
| AI route rate limiting | Medium | Eng subagent review | Add `@fastify/rate-limit` 10 req/min/userId on AI generation route. Low priority until real users hit it; add when first rate-limit incident occurs. |
| AI streaming (SSE) for generation modal | Medium | Design review TASTE DECISION | Non-streaming batch is the MVP. SSE improves perceived performance for 3s+ calls. Deferred to after MVP validates. |
| ~~Epic 17 Smart Test Selection~~ | Medium | /office-hours roadmap | **Completed: v0.1.0.1 — smart run UI accordion in CreateRunPage + `/suggest-tests` endpoint** |
| ~~Bulk run status update (2.9)~~ | Low | Sprint scope | **Completed: v0.1.0.1 — `POST /api/runs/:runId/tests/bulk-status` + BulkStatusBar UI** |

| Item | Priority | Source | Notes |
|------|----------|--------|-------|
| ~~oklch() token value validator~~ | Medium | Eng review | **Completed: v0.1.0.0** — `scripts/validate-oklch.mjs` + `validate:tokens` npm script |
| ~~Docker-based Playwright snapshot generation~~ | Medium | Eng review | **Completed: v0.1.0.0** — `scripts/update-snapshots.sh` + DESIGN_SYSTEM.md docs |
| ~~Tailwind 4 + shadcn/ui compatibility research~~ | High | Outside voice + Eng review | **Completed: v0.1.0.0 (Phase 4)** — shadcn/ui integrated, tokens bridge via CSS vars |

---

## From /review Sprint A (2026-04-04, sprint-03-04-26-1)

### Fixed by /review

| Issue | Severity | Fix | Commit |
|-------|----------|-----|--------|
| AI insertion loop not transactional | Medium | Wrap case+step loop in `db.transaction()` | 94c684c |
| Duplicate caseIds cause false "not found" | Low | Deduplicate with `new Set()` before `inArray()` check | 94c684c |
| Bulk move/copy missing permission checks | Medium | Add `can("cases.edit")` on move, `can("cases.create")` on copy | 94c684c |
| Delete as default bulk action — accidental data loss risk | Medium | Default changed to "move"; Delete moved to end of dropdown; `window.confirm` added | 94c684c |
| Modal focus not restored after close | Low | Store trigger ref on open; restore in `onDialogClose` handler; improve aria-label | 94c684c |

### Deferred (SHOULD-FIX / NICE-TO-HAVE)

| Item | Priority | Notes |
|------|----------|-------|
| Bulk-copy memory at scale | SHOULD-FIX | 500 cases × 50 steps = ~25k rows in-heap. Fine for MVP; chunk if >1k cases/suite becomes realistic |
| SuiteView: call `load()` after AI generation | SHOULD-FIX | Section tree doesn't refresh after cases added; add `load()` call after `setAiResult()` |
| AI case traceability / audit badge | NICE-TO-HAVE | No badge distinguishing AI-generated cases; add `source: "ai"` column to `testCases` eventually |
| `<dialog>` polyfill for older Android (<12) | NICE-TO-HAVE | `dialog-polyfill` if mobile analytics show older Android users |



### Fixed by /qa

| Issue | Severity | Fix | Commit |
|-------|----------|-----|--------|
| ISSUE-005: XML delimiter injection in AI prompt | Medium | Escape `</request>` in user input; sanitize section/suite names | ff2d410 |
| ISSUE-006: Non-object items crash AI JSON parse loop | Medium | Guard `typeof item !== "object"` before `.title` access | e6c9b54 |
| ISSUE-007: Bulk action success shown in red `text-error` style | Low | Add `bulkSuccess` state, render with `text-success` | b7bf040 |
| ISSUE-008: Modal event listener re-registered every render | Low | `onCloseRef` + `useLayoutEffect` pattern; stable effect deps | 3e11a00 |

### Deferred (false positives / pre-existing patterns)

| Issue | Finding | Why deferred |
|-------|---------|--------------|
| ISSUE-001: Cascade delete orphans | PostgreSQL FK `onDelete: "cascade"` on `caseVersions`, `caseFieldValues`, `testSteps` → auto-cascades. No orphan risk. | False positive — schema handles it |
| ISSUE-002: Per-case permission on bulk delete | Project-scope check (`assertProjectAccess` + `can()`) is the security boundary. Case IDs are UUIDs — enumeration risk is negligible. | Non-issue in this threat model |
| ISSUE-003: Audit trail on move | Audit log is written per bulk operation. Section context in version history is not a stored field. | Non-issue vs. existing pattern |
| ISSUE-004: No `caseVersions` on copy | Versions are created on edit, not copy. Single-case duplicate also doesn't create versions — consistent pattern. | Matches existing behavior |
| ISSUE-009: Modal backdrop click UX (WCAG) | Native `<dialog>` focus trap via browser handles baseline a11y. Rect-based backdrop detection works. | Low priority; deferred |
| ISSUE-010: Single-case delete doesn't delete testSteps | `testSteps.testCaseId` has `onDelete: "cascade"` — PG handles it. Explicit delete in code is redundant but pre-existing. | False positive |

### Health Score
- Baseline: code compiles clean, 0 TS errors, 0 ESLint errors across Sprint A files
- Post-QA: same — 4 fixes applied, all verified
- Browse-based UI testing: blocked (browse.exe Access Denied on this machine). All tests were static code analysis + TypeScript/ESLint verification.


---

## From Sprint C review (2026-04-04)

### Deferred informational findings

| Item | Priority | Source | Notes |
|------|----------|--------|-------|
| Prompt injection gap in generate-from-failure (XML-like tags not stripped) | Medium | Adversarial review | Only `</failure_log>` closing tag is escaped; `<system>` blocks passthrough; consider stripping all XML tags before interpolation | 88c1814 |
| Section dropdown in CI failure panel — no breadcrumb for duplicate names | Low | Adversarial review | Same name under different parents is ambiguous; show parent path | 88c1814 |
| Concurrent restore creates duplicate caseVersions row | Low | Adversarial review | READ COMMITTED default; both tx commit same data; version numbering shows phantom duplicate | 88c1814 |
| Audit log fires unconditionally in generate-from-failure even on empty results | Low | API contract specialist | Should only log when cases are actually created | 88c1814 |
| No rate limiting on AI endpoints (generate-cases + generate-from-failure) | Medium | Adversarial review | Any member can exhaust Anthropic quota; needs Fastify rate-limit plugin | 88c1814 |
| Zero test coverage for restore endpoint and generate-from-failure endpoint | High | Testing specialist | No E2E or unit tests for 5 auth branches of restore, nor any path of generate-from-failure | 88c1814 |
