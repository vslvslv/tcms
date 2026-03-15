# TCMS Design System

This document describes the CSS strategy, design tokens, and UI components used to keep the UI consistent. The app uses **Shadcn UI** (Radix primitives + Tailwind) for most primitives, with theme variables aligned to our tokens.

## Theme tokens

Defined in `web/src/index.css`. Shadcn uses CSS variables (`--primary`, `--background`, etc.) under `:root`; these are mapped in `@theme inline` for Tailwind. Additional app tokens live in `@theme`.

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

Use semantic utilities: `text-primary`, `bg-primary`, `text-muted`, `border-border`, `bg-error/10`, etc. Prefer these over raw palette classes so theming stays in one place.

### Other

| Token | Usage |
|-------|--------|
| `radius-card` | Card and panel corners → `rounded-card` |
| `shadow-card` | Card shadow → `shadow-card` |
| `font-sans` | Body font (via CSS variable in `body`) |

## When to use what

- **Links (in-content)**: `text-primary hover:underline`. Global `<a>` in index.css already uses theme colors.
- **Buttons**: Use `Button` / `SubmitButton` from `components/ui/Button` (variants: primary, secondary, ghost, danger). Implemented with Shadcn-style button; theme tokens applied via variants.
- **Form fields**: Use `Input`, `Label`, and `Select` from `components/ui`. Select uses Radix (Select, SelectTrigger, SelectValue, SelectContent, SelectItem).
- **Alerts**: Error: `border-error/30 bg-error/10 text-error`. Success: same pattern with `success`.
- **Tables**: Use `Table`, `TableHead`, `TableHeaderRow`, `TableHeadCell`, `TableBody`, `TableRow`, `TableCell` from `components/ui/Table` (Shadcn-style).
- **Section headings**: Use `SectionHeading` from `components/ui/SectionHeading` (custom wrapper).
- **Status badges**: Use `StatusBadge` from `components/ui/StatusBadge` for case status (draft, ready, approved); implemented with Shadcn `Badge`.

## Shared components

| Component | Path | Purpose |
|-----------|------|---------|
| Button / SubmitButton | `components/ui/Button` | Actions; variant + optional className |
| Card, CardHeader, CardTitle, CardContent, CardFooter | `components/ui/Card` | Content containers (Shadcn) |
| Input | `components/ui/Input` | Text inputs (Shadcn) |
| Label | `components/ui/Label` | Form labels (Radix Label) |
| Select, SelectTrigger, SelectValue, SelectContent, SelectItem | `components/ui/Select` | Radix-based select; use composition, not native `<option>` |
| DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem | `components/ui/dropdown-menu` | Menus (e.g. User menu, Project switcher) |
| Dialog, DialogProvider, useDialog | `components/ui/Dialog` | Modals and imperative confirm/alert/custom (Shadcn/Radix) |
| Table, TableHead, TableBody, TableRow, TableHeaderRow, TableHeadCell, TableCell | `components/ui/Table` | Tables (Shadcn-style) |
| Badge | `components/ui/Badge` | Badges with variants (default, secondary, destructive, success, etc.) |
| StatusBadge | `components/ui/StatusBadge` | Case status badge (wraps Badge) |
| EmptyState | `components/ui/EmptyState` | Empty list message + optional action |
| Breadcrumb | `components/ui/Breadcrumb` | Breadcrumb navigation (items: { label, to? }[]) |
| LoadingSpinner | `components/ui/LoadingSpinner` | Loading indicator |
| PageTitle | `components/ui/PageTitle` | Page title (h1) – custom |
| SectionHeading | `components/ui/SectionHeading` | Section titles – custom |
| AppLink | `components/ui/AppLink` | In-app link (wraps React Router Link) – custom |

All UI components accept `className` for overrides. Use `cn()` from `@/lib/utils` (or `lib/cn`) to merge classes.

## Conventions

1. **Prefer theme tokens and shared components** over raw Tailwind palette and duplicated class strings.
2. **Use `cn()`** for conditional or merged class names so Tailwind classes combine correctly.
3. **Single global stylesheet**: Tailwind and base styles in `index.css`.
4. **New components**: Use theme utilities and accept `className` for overrides.
5. **Shadcn**: New primitives (e.g. new Shadcn component) can be added via `components.json` and themed via CSS variables in `index.css`.

## Theming

The app supports three themes: **Light** (default), **Dark**, and **Slate** (neutral, low-saturation light). The active theme is applied via `data-theme` on `<html>` (`"light"` | `"dark"` | `"slate"`); all semantic CSS variables are defined per theme in `web/src/index.css`.

- **How to switch**: Open the header **user dropdown** (top right) and choose **Theme** → Light, Dark, or Slate. The selection is applied immediately.
- **Persistence**: The chosen theme is stored in `localStorage` under the key `tcms_theme`. On first visit (no stored value), the app uses the OS preference (`prefers-color-scheme: dark`) to default to Dark or Light.
- **Avoiding flash**: An inline script in `web/index.html` runs before the first paint and sets `data-theme` from `localStorage` or system preference so the initial render uses the correct theme.
- **Adding a theme**: (1) Add a new block in `index.css`, e.g. `[data-theme="newtheme"] { ... }`, with the same variable names as `:root`. (2) Extend the theme id type and options in `ThemeContext.tsx` and in the Layout theme switcher. (3) Update the inline script in `index.html` to include the new value in the valid list.

## Menus and selects

- **Choice lists (forms)**: Use `Select` with `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`. Controlled via `value` and `onValueChange`.
- **Custom menus**: Use `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` from `components/ui/dropdown-menu`. Use `open` / `onOpenChange` for controlled mode (e.g. closing one when another opens).
