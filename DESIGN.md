# Design System — TCMS

## Product Context
- **What this is:** TestRail-like test case management platform for organizing, running, and tracking QA test cases, runs, plans, and results
- **Who it's for:** QA engineers at enterprise companies who use this tool for hours every day during sprint cycles
- **Space/industry:** Test management / QA tooling (TestRail, Zephyr, Xray, Testmo)
- **Project type:** Web app / dashboard — data-dense internal tool, not marketing site

## Aesthetic Direction
- **Direction:** Industrial / Precision Dark
- **Decoration level:** Minimal — the dark background and monospaced data do the heavy lifting; no gradients, no decorative blobs, no pattern fills; single subtle grain texture on background surface is optional and restrained
- **Mood:** A calibrated instrument, not a spreadsheet. The tool should feel like it was made in a research lab: purposeful, dense, honest about what it does. QA engineers live in terminals; TCMS should feel native to that world.
- **Design philosophy:** Every QA tool in this category is a blue-anchored enterprise spreadsheet with zero personality. TCMS deliberately takes three risks: dark-first default, teal accent instead of corporate blue, and Instrument Serif for hierarchy signaling. These are intentional departures, not accidents.

## Typography

- **Display / Hierarchy:** [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) — italic weight only; used SPARINGLY at the top of the navigation tree (suite names, milestone titles, project names); signals that a test suite has identity and importance; nobody in QA tooling uses serifs — that's the point
- **UI / Body / Navigation:** [Geist](https://vercel.com/font) — all interactive elements, nav items, form labels, body text, table rows, button labels; tabular nums built in; precise without being a coding font
- **Data / Code:** [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — test case IDs, step numbers, metric counts, code values, timestamps in tables; the tables feel like terminal output, which is native to QA engineers
- **Loading:** Google Fonts CDN — `https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap`

### Type Scale
| Level | Font | Size | Weight | Usage |
|-------|------|------|--------|-------|
| Page title | Geist | 18px | 600 | Main content area heading |
| Section header | Geist | 16px | 500 | Subsection, panel title |
| Suite name (tree) | Instrument Serif italic | 14px | 400 | Sidebar tree top nodes only |
| Body / table rows | Geist | 13–14px | 400 | Standard content |
| Metadata | Geist | 12px | 400 | Timestamps, helper text |
| Column headers | Geist | 11px | 600 | All-caps, 0.08em letter-spacing |
| IDs / numbers | JetBrains Mono | 12px | 400–500 | Test IDs, metrics, step nums |

## Color

- **Approach:** Restrained — teal accent is rare and meaningful; status colors are semantic-only (cell level), never used for branding

### Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#141418` | Page background — obsidian with cool violet undertone; not navy, not pure black |
| `--surface` | `#1E1E24` | Cards, panels, modals, sidebar, topbar |
| `--surface2` | `#26262E` | Hover states, secondary inputs, nested surfaces |
| `--border` | `#2E2E38` | All dividers and borders |
| `--accent` | `#4E9B8F` | Primary accent — wayfinding, active states, focus rings, primary buttons |
| `--accent-dim` | `#3A7A70` | Accent hover / pressed state |
| `--text` | `#E8E8F0` | Primary text — off-white with violet cast, readable all day on dark surfaces |
| `--muted` | `#6B6B7A` | Secondary text — labels, timestamps, metadata, nav items at rest |
| `--muted2` | `#4A4A58` | Tertiary text, borders in some contexts |
| `--pass` | `#4CAF50` | Test status: Passed — semantic only, at the cell level |
| `--fail` | `#E05252` | Test status: Failed — semantic only, at the cell level |
| `--blocked` | `#E8A045` | Test status: Blocked — semantic only, at the cell level (amber chosen for semantic clarity, NOT as brand accent — avoid using amber outside of blocked status) |
| `--info` | `#4E9B8F` | Informational alerts (same as accent) |

### Light Mode Overrides
| Token | Light Hex |
|-------|-----------|
| `--bg` | `#F4F4F7` |
| `--surface` | `#FFFFFF` |
| `--surface2` | `#EBEBF0` |
| `--border` | `#D8D8E0` |
| `--accent` | `#3A857A` |
| `--accent-dim` | `#2E6B62` |
| `--text` | `#18181F` |
| `--muted` | `#7A7A8A` |
| `--muted2` | `#B0B0BF` |
| `--pass` | `#2E8B34` |
| `--fail` | `#C03030` |
| `--blocked` | `#C27A1A` |

Dark mode is the **primary/default** mode. Light mode is the alternate. Both must remain polished.

### Status Color Rule
Status colors (pass/fail/blocked) appear **at the cell level only** — as small dots, colored text within a monospaced badge, or minimal inline indicators. The page-level chrome (sidebar, topbar, panels) stays monochrome. When something is failing, the red in the table punches through the dark background with clear signal. The relationship is: the tool itself is calm, the data speaks.

## Spacing
- **Base unit:** 4px
- **Density:** Tight on data (appropriate for an enterprise tool QA engineers stare at all day)
- **Table row height:** 32px — tight but not cramped
- **Section headers:** 48px+ — the eye needs anchors in the density

### Scale
| Name | Value | Usage |
|------|-------|-------|
| 2xs | 2px | Micro gaps, icon margins |
| xs | 4px | Dense inline gaps |
| sm | 8px | Within-component gaps |
| md | 16px | Standard padding |
| lg | 24px | Section internal padding |
| xl | 32px | Between sections |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level breathing room |

## Layout
- **Approach:** Grid-disciplined — sidebar owns navigation, content area owns data, they never fight
- **Left rail:** 240px fixed width, low-contrast at rest; not fighting the data
- **Content max width:** 1280px
- **Grid:** single main column inside content area; no multi-column layouts for data tables
- **Border radius scale:** micro: 4px (badges, chips), sm: 6px (buttons, inputs), md: 8px (cards), lg: 10px (panels, modals), full: 9999px (avatars)

### Layout Rules
- **Tables** for test case lists, test run lists, results — 32px rows, sticky headers, not cards
- **Cards** only for dashboard metrics, summaries, and stat blocks — not for data lists
- Tables should feel like spreadsheets with taste. Not SaaS marketing pages.

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** enter: `ease-out`, exit: `ease-in`, move: `ease-in-out`
- **Duration:** micro: 100ms (hover states), short: 150ms (panel transitions, tooltips), medium: 250ms (modal open/close), long: 400ms (page-level transitions, avoided)
- **No entrance animations on tables or list items.** Data loads, it doesn't animate in.
- **No scroll-driven animation.** This is a tool, not a portfolio.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-17 | Dark-first default | Every major QA tool defaults to light; dev tools (VS Code, Linear, GitHub) default dark; QA engineers live in terminals. Gain: immediate impression this isn't TestRail. Risk: some enterprise IT policies prefer light. |
| 2026-04-17 | Teal accent (#4E9B8F) instead of corporate blue | Entire category (TestRail, Zephyr, Xray, PractiTest) anchors on medium corporate blue. Teal is distinctive without being garish. Avoids semantic collision with amber-blocked status. |
| 2026-04-17 | Instrument Serif for suite/milestone hierarchy | Zero QA tools use serifs anywhere. Used sparingly at the top level only (suite names, milestones). Communicates that test suites have identity and importance, not just folder-like nesting. |
| 2026-04-17 | JetBrains Mono for data tables | QA engineers live in terminals. Mono IDs, metrics, and step numbers feel native. Tabular nums ensure number columns align correctly. |
| 2026-04-17 | Status colors at cell level only | Status as signal, not label. The page chrome stays monochrome; status colors in tables punch through the dark background with maximum clarity. Keeps the tool calm; the data speaks. |
| 2026-04-17 | Amber reserved for Blocked status only | Amber could collide with brand accent. Reserved strictly for Blocked test status. Do not use amber for UI decoration, highlights, or branding. |
| 2026-04-17 | 32px table row height | Tight but readable for enterprise-density data. Not cramped like TestRail's classic rows; not wasteful like enterprise whitespace theater. |
