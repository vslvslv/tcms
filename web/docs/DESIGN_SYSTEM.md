# TCMS Design System

This document describes the CSS strategy and design tokens used to keep the UI consistent across the application.

## Theme tokens

Defined in `web/src/index.css` under `@theme`. Tailwind v4 turns these into utility classes.

### Colors

| Token | Usage |
|-------|--------|
| `primary` / `primary-hover` | Links, primary buttons, active states, accents |
| `success` | Success messages, approved status, positive feedback |
| `error` | Errors, destructive actions, validation alerts |
| `warning` | Warnings, caution states |
| `muted` | Secondary text, placeholders, labels, disabled |
| `background` | Page background |
| `surface` | Cards, dropdowns, modals |
| `border` | Borders (inputs, cards, dividers) |

Use semantic utilities: `text-primary`, `bg-primary`, `text-muted`, `border-border`, `bg-error/10`, etc. Prefer these over raw palette classes (`text-blue-600`, `text-gray-500`) so theming and consistency stay in one place.

### Other

| Token | Usage |
|-------|--------|
| `radius-card` | Card and panel corners → `rounded-card` |
| `shadow-card` | Card shadow → `shadow-card` |
| `font-sans` | Body font (via CSS variable in `body`) |

## When to use what

- **Links (in-content)**: `text-primary hover:underline`. Global `<a>` in index.css already uses theme colors.
- **Buttons**: Use `Button` / `SubmitButton` from `components/ui/Button` (variants: primary, secondary, ghost). They use theme tokens.
- **Form fields**: Use `Input`, `Label`, and `Select` from `components/ui`. Input and Select use `border-border` and `focus:ring-primary`.
- **Alerts**: Error: `border-error/30 bg-error/10 text-error`. Success: same pattern with `success`.
- **Tables**: Shared header/row styles; use `border-border` for borders. Consider `Table` wrapper for new screens.
- **Section headings**: Use `SectionHeading` from `components/ui/SectionHeading` (semantic, muted style).
- **Status badges**: Use `StatusBadge` from `components/ui/StatusBadge` for case status (draft, ready, approved).

## Shared components

| Component | Path | Purpose |
|-----------|------|---------|
| Button / SubmitButton | `components/ui/Button` | Actions; use variant and optional className |
| Card | `components/ui/Card` | Content containers |
| Input | `components/ui/Input` | Text inputs with consistent focus style |
| Label | `components/ui/Label` | Form labels |
| Select | `components/ui/Select` | Native `<select>` with same border/focus as Input |
| Dropdown | `components/ui/Dropdown` | Custom click-to-open menu or listbox (trigger + panel) |
| DropdownItem | `components/ui/Dropdown` | Menu/list option inside Dropdown; use `role="option"` and `selected` for listbox |
| SectionHeading | `components/ui/SectionHeading` | Section titles (muted, uppercase) |
| StatusBadge | `components/ui/StatusBadge` | Case status (draft/ready/approved) |
| PageTitle | `components/ui/PageTitle` | Page title (h1) |
| EmptyState | `components/ui/EmptyState` | Empty list message + optional action |
| Breadcrumb | `components/ui/Breadcrumb` | Breadcrumb navigation |
| LoadingSpinner | `components/ui/LoadingSpinner` | Loading indicator |
| AppLink | `components/ui/AppLink` | In-app link with primary style (wraps React Router `Link`) |
| Table, TableHead, TableBody, TableRow, TableHeaderRow, TableHeadCell, TableCell | `components/ui/Table` | Consistent table layout and borders |

All UI components accept `className` for layout or one-off overrides; merge with base styles (e.g. using `cn()`).

## Conventions

1. **Prefer theme tokens and shared components** over raw Tailwind palette and duplicated class strings.
2. **Use `cn()`** (from `lib/cn`) for conditional or merged class names so Tailwind classes combine correctly.
3. **Single global stylesheet**: Tailwind and base styles live in `index.css`; no separate App.css.
4. **New components**: Use theme utilities (`text-primary`, `border-border`, etc.) and accept `className` for overrides.

## Dropdowns

- **Native choice lists**: Use `Select` for form dropdowns (e.g. project, status, priority). Same look as Input (border, focus ring).
- **Custom menus**: Use `Dropdown` + `DropdownItem` for actions (e.g. Add menu, User menu) or single-choice lists (e.g. Project switcher). Behavior: overlay to close on outside click, Escape to close, optional `align="right"`, optional `panelMaxHeight="max-h-72"` for scrollable panels. Use `open` / `onOpenChange` for controlled mode.
- **Consistency**: All dropdown panels use `border-border`, `bg-surface`, `shadow-lg`; items use `hover:bg-gray-100`; selected listbox option uses `bg-primary/10`.
