# Changelog

All notable changes to TCMS are documented in this file.

## [0.3.0.0] - 2026-04-05

### Added
- **Run Activity Tab (Story 18.1):** Real-time audit log for each test run. Shows who created the run, status changes, and all actions — with timestamps and actor names. Previously a stub.
- **Run Progress Tab (Story 18.2):** Pass-rate trend chart using Recharts `LineChart`. Plots daily pass percentage as tests are executed. Shows "Not enough data yet" until at least 2 data points exist.
- **Run Defects Tab (Story 18.3):** Aggregated list of all issue links from results in the run. New `GET /api/runs/:id/defects` endpoint joins issue links across all tests in the run.
- **Needs Attention Page (Story 19.1):** New `/todo` route shows cases awaiting review (status=ready) and open test runs across all your projects. Loading skeletons, empty state, and batched parallel fetching.
- **Milestone Inline Edit (Story 20.1):** Pencil icon on each milestone opens an inline form to edit name, description, and due date without leaving the project page.
- **Milestone Delete (Story 20.2):** Delete button in milestone row with confirmation. Immediately reflects in the milestone list.
- **Milestone Description Field (Story 20.3):** Create milestone form now includes a description input field.
- **Project Settings Redesign (Stories 21.1-21.5):** 5-tab layout — General, Members, Case Config, Integrations, Danger. All inline styles and hardcoded colors removed. Audit log auto-loads when Danger tab opens. Project delete requires typing the project name to confirm.
- **Sidebar Navigation Restructure (Stories 22.1-22.5):** "Project" and "Workspace" section labels. Active project badge. Milestone sub-links with lazy loading and 5-minute cache. To Do nav item links to `/todo`. Report Builder sub-link appears when on `/reports`.
- **Multi-Suite Cases Overview:** Cases Overview now loads and displays sections from all suites in a project, not just the first.
- **E2E Spec Consolidation:** 9 sprint-named spec files replaced with 4 domain-organized canonical files (`authentication.spec.ts`, `projects.spec.ts`, `test-design.spec.ts`, `test-execution.spec.ts`).

### Changed
- `GET /api/projects/:id/audit-log` now accepts `entityId` UUID query parameter for filtering the log to a specific entity (run, case, etc.).
- Sidebar always visible — `showSidebar` default changed to `true`.

## [0.2.0.0] - 2026-04-04

### Added
- **AI Test Generation from CI Failures (Story 14.4):** `POST /api/projects/:id/generate-from-failure` accepts a CI failure log and optional PRD context, returning 3-8 structured test case suggestions with reasoning. Suggestions can be auto-inserted into a suite section. Accessible from the "Generate from CI failure" collapsible panel in SuiteView.
- **Version Restore (Story 5.6):** `POST /api/cases/:id/versions/:versionId/restore` restores a case to any prior version snapshot (title, prerequisite, steps). Approval status is reset. History UI shows "Restore this version" button with confirmation dialog.
- **Full UI Redesign:** Dark/light theme with oklch-based design system. Token classes (`bg-surface`, `text-muted`, etc.) replace all hardcoded Tailwind palette references. shadcn/ui integrated with TCMS token bridge. Storybook 8 with stories for all 14 UI primitives.
- **Docker Development Setup:** `docker-compose.yml` with hot-reload for api + web + PostgreSQL + MinIO. `api/entrypoint.sh` runs migrations + seeds on first boot.
- **Password Reset Flow:** Token-based reset with email delivery. `ResetRequest` and `ResetConfirm` pages match login card styling.
- **Google OAuth:** `/api/auth/oauth/google/authorize` + callback. Button visible in light and dark themes.
- **Enterprise Permissions:** Fine-grained `can(userId, projectId, action)` matrix with admin/lead/tester roles. All mutation endpoints gate on specific actions (`cases.create`, `cases.edit`, `cases.delete`).
- **File Attachments (Epic 3):** S3-compatible storage via MinIO. `AttachmentPanel` component with inline image thumbnails, lightbox preview, and download links.
- **Run Intelligence:** Flaky test badge (`FlakyBadge`) in run view, smart run selection UI (suggest tests by changed files), bulk test status update, status filter + checkbox toolbar.
- **Reporting & Analytics:** `ReportBuilder` with date range filter, status breakdown chart, CSV export. `MilestoneProgress` page. `Dashboard` with 7-day activity chart.
- **User Management:** Admin user list, profile edit, notification preferences, API token management (SHA-256 hashed, 90-day expiry).
- **Shared Steps:** Create, edit, delete shared steps with automatic propagation to all referencing test steps via transaction.
- **Dataset Management:** Column/row grid editor for test datasets.
- **Case Version History:** Full version history with diff view. Restore to any prior version.
- **Bulk Case Operations:** Move, copy, delete with permission checks. Case search (FTS via ILIKE).
- **AI Case Generation (Story 14.1-14.3):** Generate test cases from section context via Claude Haiku.
- **Webhook Notifications:** Slack/Teams templates for run events.
- **Keyboard Shortcuts:** Suite view and run view keyboard nav. Re-run failures shortcut.
- **Visual Regression Testing:** Playwright visual snapshots for dark + light themes. `scripts/update-snapshots.sh` for Docker-consistent baselines.
- **Accessibility Testing:** axe-core WCAG 2.1 AA audit across 5 pages × 2 themes via `npm run test:a11y`.

### Fixed
- Transaction atomicity on `testCases` PATCH — all sub-writes (steps, field values, version entry) in a single `db.transaction`.
- Transaction atomicity on `sharedSteps` PATCH and DELETE — propagation to `testSteps` is atomic.
- Shared steps write permission — `can(cases.edit)` on POST/PATCH, `can(cases.delete)` on DELETE.
- AI endpoints permission gate — `can(cases.create)` required before calling Anthropic API.
- Prompt injection via CI failure log XML tags — both opening and closing variants sanitized.
- Version restore race condition — version fetch + HEAD check moved inside the transaction.
- Fastify error status codes from restore endpoint — switched from thrown errors with `statusCode` to typed return values handled via `replyError()`.
- recharts `ResponsiveContainer` console warnings on Reports and ProjectDetail pages.



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
