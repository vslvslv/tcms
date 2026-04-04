# Changelog

All notable changes to TCMS are documented in this file.

## [0.1.0.1] - 2026-04-04

### Added
- **Case Search (Story 1.9):** Full-text case title search via `GET /api/projects/:id/cases/search?q=`. `<CaseSearchBar>` component in suite view with 250 ms debounce, keyboard navigation (ArrowUp/Down, Enter, Escape), ARIA `role="search"` + `role="listbox"`, breadcrumb path below each result. ILIKE query limited to 50 results, scoped to project via `assertProjectAccess`.
- **Flaky Test Badge (Story 16.3):** `<FlakyBadge>` renders an amber "Flaky" chip next to test case titles in run view when `flakinessScore > 3`. Score loaded once per page via `/api/projects/:id/flaky-tests` and stored in a `Map<caseId, score>`.
- **Smart Run Selection UI (Story 17.4):** Collapsible "Smart selection (optional)" accordion in Create Run page. Enter changed file paths to retrieve AI-suggested test cases correlated with those files via `/api/projects/:id/suggest-tests`. Results shown as a pre-checked list with correlation counts.
- **Bulk Test Status Update (Story 2.9):** `POST /api/runs/:runId/tests/bulk-status` accepts up to 500 test IDs and a status string. Cross-run ownership validated (400 if any test ID doesn't belong to the run). Section-level "select all" checkbox and per-row checkboxes in run view; floating `BulkStatusBar` toolbar replaces normal toolbar when tests are selected. Audit log entry written on success (`result.bulk_updated`).
- **Run Status Filter (Story 2.11):** Client-side filter dropdown in run view (All / Passed / Failed / Blocked / Skipped / Untested). Empty state shows count and "Clear filter" link when filtered list is empty.
- **Unit tests:** `FlakyBadge.test.tsx` (6 cases), `CaseSearchBar.test.tsx` (8 cases) — all passing with vitest + @testing-library/react.

### Changed
- `AuditAction` union extended with `"result.bulk_updated"` to cover bulk status writes.
- BACKLOG.md: 5 items marked ✅ (5.2, 5.4, 5.5, 17.2, 17.3); summary table updated to 68 done / 8 partial / 45 missing.

## [0.1.0.0] - 2026-04-04

### Added
- **AI Test Generation (Epic 14):** Generate test cases from natural language prompts via Anthropic Claude Haiku. Access from suite view via "Generate with AI" per section. Requires `ANTHROPIC_API_KEY` in `api/.env`; gracefully disabled (503) without it. Cases and steps inserted atomically in a single transaction.
- **Bulk Case Operations (Story 1.7):** Select multiple test cases with checkboxes and apply bulk delete, move-to-section, or copy-to-section actions. Move defaults to avoid accidental deletions; delete requires explicit confirmation.
- **Case Duplication (Story 1.8):** Duplicate any test case (with all steps and custom field values) from the case editor header. The copy lands in the same section with " (Copy)" suffix.
- **Design system quality infrastructure:** Visual regression testing (Playwright snapshots), axe-core WCAG 2.1 AA accessibility audit, Storybook 8 with stories for all 14 UI components, shadcn/ui foundation with Base UI dropdown, responsive sidebar with FocusScope and scroll lock.
- **Modal primitive:** New reusable `<Modal>` component using native `<dialog>` with focus restoration, backdrop click dismiss, and contextual aria-labels.
- **oklch() token validator:** `npm run validate:tokens` checks all design tokens in `index.css` for valid ranges — prevents invisible colors from invalid oklch values.
- **Docker Playwright snapshot script:** `scripts/update-snapshots.sh` generates visual baselines inside the official Playwright Docker image for cross-machine reproducibility.

### Changed
- **Permission model:** Bulk move requires `cases.edit`; bulk copy requires `cases.create`; bulk delete requires `cases.delete`. Previously move/copy had no explicit permission check.
- Design tokens: all new UI uses oklch token classes (`bg-surface`, `text-primary`, etc.) — no hardcoded Tailwind palette classes in any Sprint A file.

### Fixed
- AI prompt XML delimiter injection: user-supplied prompts that contain `</request>` are escaped before sending to the model.
- AI JSON response guard: non-object items in the model's array response are skipped safely.
- Bulk action success message now renders in green (`text-success`), not red.
- Modal event listener was re-registered on every render; stabilized with `onCloseRef` pattern.
