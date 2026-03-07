---
name: testrail-component-replication
description: Researches how a UI component or screen is implemented in TestRail and implements it in TCMS to match as closely as possible. Use when the user asks to implement something like TestRail, replicate a TestRail component, build a feature "as in TestRail", or to check TestRail and implement it in our system.
---

# TestRail Component Replication

When asked to implement a component or screen "like TestRail" or "as in TestRail", follow this workflow: research TestRail's implementation, then implement in TCMS to match.

## Workflow

**1. Research TestRail**

- Identify the component or screen (e.g. Dashboard, Test Run view, Case editor, Milestone progress).
- Check TestRail's behavior and layout:
  - **Support / docs**: [support.testrail.com](https://support.testrail.com/hc/en-us) — search for the feature name (e.g. "Dashboard", "test run", "charts").
  - **Blog / product**: [testrail.com/blog](https://testrail.com/blog), [testrail.com/platform](https://testrail.com/platform) for high-level UI/structure.
  - **Live reference** (if available): [copyrail123.testrail.io](https://copyrail123.testrail.io/) — use for UI/flow checks only; do not rely on it for logic.
- Note: layout (sidebar, header, tabs), sections, tables vs lists, charts, actions (buttons, links), and any copy/labels that matter.

**2. Map to TCMS**

- Use [REPLICATION_PLAN.md](../../../REPLICATION_PLAN.md) for entity names and hierarchy (Project, Suite, Section, Test Case, Run, Plan, Milestone).
- Confirm TCMS already has the needed API/data. If not, add or extend API first, then UI.
- Reuse existing patterns: Layout (shell), Card, Button, PageTitle, tables, status badges, LoadingSpinner, EmptyState. Stack: React, Vite, Tailwind, `web/src/components/ui/`.

**3. Implement in TCMS**

- Build the screen or component so it **looks and behaves** like TestRail where feasible:
  - Same overall structure (e.g. stats strip, then chart, then list).
  - Same sections and hierarchy (e.g. Activity, then Projects, Milestones, Plans, Recent runs).
  - Same interaction patterns (e.g. table with View/Settings, primary action in header).
- Use Tailwind and existing design tokens (primary blue, success/error/warning for status). Keep density and typography professional (TestRail-like).
- Do not invent features TestRail does not show for that screen; stay aligned with what was researched.

## Research Sources (quick reference)

| What you need | Where to look |
|---------------|----------------|
| Dashboard, charts, activity | Support: "Charts and dashboards", "Dashboard" |
| Test run / results UI | Support: "Test runs", "Results" |
| Case list, case editor | Support: "Test cases", "Sections" |
| Milestones, plans | Support: "Milestones", "Test plans" |
| Navigation, sidebar, header | Blog: "TestRail 9.0" (left sidebar, Add dropdown, header) |
| Data model / API | [REPLICATION_PLAN.md](../../../REPLICATION_PLAN.md), TCMS API in `api/` |

## Implementation checklist

- [ ] Researched TestRail (docs and/or live UI) for this component.
- [ ] Mapped to TCMS entities and existing API.
- [ ] Reused Layout, Card, Button, PageTitle, tables, and design system where applicable.
- [ ] Matched layout order and sections to TestRail where it makes sense.
- [ ] Used consistent status colors (e.g. pass=green, fail=red, blocked=amber).
- [ ] No new feature beyond what TestRail shows for this component without user ask.

## When TCMS differs

If TCMS has no equivalent entity or API yet, either:

- Add minimal backend/API to support the component, then implement UI; or
- Implement the UI with the closest existing data and note the gap (e.g. "Filters will work once project X is implemented").

Prefer aligning with TestRail’s **structure and UX** first; optional extras (e.g. export, advanced filters) only if the user requests them.
