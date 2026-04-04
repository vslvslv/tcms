# Changelog

All notable changes to TCMS are documented in this file.

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
