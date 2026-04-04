# TCMS Design System

Reference for the design token system, component library, testing infrastructure, and accessibility standards used in `web/`.

---

## Token System

### Why oklch?

All color tokens use `oklch()` channel format (not hex). Reasons:

1. **shadcn/ui compatibility** — shadcn reads CSS vars as color channels; hex values produce invalid CSS when composed into `oklch()`/`hsl()` by shadcn primitives.
2. **Predictable contrast** — oklch is perceptually uniform, so lightness values map directly to WCAG contrast ratios.

**Rule: never use hardcoded Tailwind palette classes in JSX** (e.g. `bg-slate-700`, `text-green-500`). The ESLint rule `no-restricted-syntax` in `eslint.config.js` enforces this at build time.

Use design token classes instead: `bg-surface-raised`, `text-muted`, `border-border`, etc.

### Token Table

| Token | Tailwind class | Dark value | Light value | Use |
|-------|---------------|-----------|------------|-----|
| `--color-background` | `bg-background` | `oklch(0.173 …)` | `oklch(0.985 …)` | Page background |
| `--color-surface` | `bg-surface` | `oklch(0.233 …)` | `oklch(1 0 0)` | Card / panel |
| `--color-surface-raised` | `bg-surface-raised` | `oklch(0.345 …)` | `oklch(0.968 …)` | Hover, table header |
| `--color-border` | `border-border` | `oklch(0.484 … / 0.5)` | `oklch(0.928 …)` | Borders, dividers |
| `--color-text` | `text-text` | `oklch(0.968 …)` | `oklch(0.173 …)` | Primary text |
| `--color-muted` | `text-muted` | `oklch(0.678 …)` | `oklch(0.551 …)` | Secondary text |
| `--color-primary` | `text-primary`, `bg-primary` | `oklch(0.723 …)` | `oklch(0.647 …)` | Brand green, links |
| `--color-primary-hover` | `hover:bg-primary-hover` | `oklch(0.647 …)` | `oklch(0.596 …)` | Primary hover |
| `--color-success` | `text-success` | same as primary | same as primary | Pass state |
| `--color-error` | `text-error`, `bg-error` | `oklch(0.637 …)` | `oklch(0.577 …)` | Fail / destructive |
| `--color-warning` | `text-warning` | `oklch(0.769 …)` | `oklch(0.717 …)` | Blocked state |

### Dark and Light Themes

Theme is controlled by the `data-theme` attribute on `<html>`:

- `:root, [data-theme="dark"]` — default dark theme
- `[data-theme="light"]` — light theme

`ThemeContext` manages the toggle and persists the preference to `localStorage` under key `tcms-theme`.

All theme CSS lives in `src/index.css`. The `@theme inline {}` block forwards every TCMS token to Tailwind, making them available as utility classes.

### shadcn/ui Bridge

shadcn components expect generic CSS vars (`--background`, `--primary`, `--border`, etc.). Both theme blocks in `index.css` map these to TCMS tokens:

```css
--background:        var(--color-background);
--foreground:        var(--color-text);
--card:              var(--color-surface);
--popover:           var(--color-surface);
--primary:           var(--color-primary);
--secondary:         var(--color-surface-raised);
--muted-foreground:  var(--color-muted);
--accent:            var(--color-surface-raised);
--destructive:       var(--color-error);
--border:            var(--color-border);
--input:             var(--color-surface-raised);
--ring:              var(--color-primary);
```

This means any shadcn primitive automatically picks up TCMS branding with zero per-component overrides.

---

## Component Library

All UI primitives live in `src/components/ui/`. Two categories:

- **TCMS primitives** — hand-rolled, use TCMS tokens directly
- **shadcn primitives** — generated via `npx shadcn@latest add <name>`, use the bridge vars

### TCMS Primitives

| Component | File | Notes |
|-----------|------|-------|
| `Button` | `Button.tsx` | `variant`: `primary \| secondary \| ghost`; also exports `SubmitButton` |
| `Card` | `Card.tsx` | `bg-surface` container with `shadow-card` |
| `Input` | `Input.tsx` | Controlled text input |
| `Select` | `Select.tsx` | Native `<select>` with token styling |
| `Modal` | `Modal.tsx` | Radix Dialog under the hood |
| `Table` / `TableRow` etc. | `Table.tsx` | Semantic table primitives |
| `Badge` | `Badge.tsx` | Status chips |
| `Tabs` | `Tabs.tsx` | `Tab` + `TabPanel` |
| `LoadingSpinner` | `LoadingSpinner.tsx` | Centered spinner |
| `PageTitle` | `PageTitle.tsx` | `<h1>` with margin |
| `Dropdown` | `Dropdown.tsx` | Wraps `dropdown-menu.tsx`; preserves original `Dropdown`/`DropdownItem` API |

### shadcn Primitives

| Component | File | Notes |
|-----------|------|-------|
| `DropdownMenu` (and sub-exports) | `dropdown-menu.tsx` | Base UI `@base-ui/react/menu`; full keyboard nav |

### Adding a New Component

1. For a simple TCMS primitive, create `src/components/ui/MyComponent.tsx` using token classes only.
2. For a complex interactive widget, run `npx shadcn@latest add <name>` from `web/`, then verify these files were not corrupted:
   - `src/components/ui/Button.tsx` — must be the TCMS version (no `buttonVariants` export)
   - `src/lib/utils.ts` — must re-export from `./cn`, not define its own `cn`
   - `src/index.css` — must retain TCMS token blocks and shadcn bridge vars
3. Never export non-component values (like `buttonVariants`) from a component file — this violates the `react-refresh/only-export-components` ESLint rule.

---

## Storybook

Storybook 8 is configured in `.storybook/` with a Vite builder.

```bash
cd web
npm run storybook          # Dev server on :6006
npm run storybook:build    # Static build to storybook-static/
```

The `@storybook/addon-themes` addon adds a **Theme** dropdown in the toolbar so stories can be viewed in dark and light mode without code changes.

The same ESLint palette guard runs on story files. Hardcoded palette classes in stories will fail the lint step.

---

## Testing

### Visual Regression

Dedicated Playwright config at repo root: `playwright.visual.config.ts`.

```bash
npm run test:visual          # Run visual snapshots (dark + light)
npm run test:visual:update   # Update baselines
```

Specs live in `web/tests/visual/`. Snapshots are committed to `web/tests/visual/__snapshots__/` and compared on each run (`maxDiffPixelRatio: 0.02`).

Setup: `web/tests/visual/visual.setup.ts` logs in as `admin@tcms.local` and saves auth state to `web/tests/visual/.auth/user.json` (gitignored).

Theme injection for visual tests:
```ts
await page.addInitScript((theme) => {
  localStorage.setItem("tcms-theme", theme);
}, "dark"); // or "light"
```

#### Updating Snapshots Across Machines

Snapshot baselines must be generated in the same environment as CI or they will fail on Linux CI after being created on macOS/Windows. Use the Docker wrapper:

```bash
bash scripts/update-snapshots.sh
```

This runs inside `mcr.microsoft.com/playwright:v1.42.0-jammy` (the same image CI uses), mounts the repo, and writes new PNG baselines to `web/tests/visual/__snapshots__/`. Review the diff with `git diff web/tests/visual/__snapshots__/` before committing.

Do **not** run `npm run test:visual:update` locally unless your machine matches the CI environment exactly (Linux + Chromium). Use the Docker script instead.


### Accessibility Audit

```bash
npm run test:a11y
```

Spec: `web/tests/visual/a11y.spec.ts`. Uses `@axe-core/playwright` with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `best-practice`. 5 pages audited in both dark and light themes. Violations are reported with impact level and target selector.

### E2E

Standard Playwright config at `playwright.config.ts`. See project `CLAUDE.md` for commands.

---

## Accessibility Standards

| Feature | Implementation | Standard |
|---------|---------------|----------|
| Skip navigation | `<a href="#main-content">` in Layout header | WCAG 2.4.1 |
| Focus trap (mobile drawer) | `<FocusScope trapped={sidebarOpen}>` from `@radix-ui/react-focus-scope` | WCAG 2.1.2 |
| Focus return after drawer close | `hamburgerRef.current?.focus()` via `requestAnimationFrame` | WCAG 2.4.3 |
| `aria-modal` on drawer | `aria-modal={sidebarOpen \|\| undefined}` on `<aside>` | ARIA 1.1 |
| Body scroll lock | `document.body.style.overflow = "hidden"` when drawer open | UX best practice |
| Reduced motion | `@media (prefers-reduced-motion: reduce) { * { transition: none !important } }` | WCAG 2.3.3 |
| Keyboard shortcuts in RunView | `j`/`k` navigate, `p`/`f`/`b`/`s` set status, `n` next untested, `?` toggle help | RunView.tsx |
| ARIA labels | `aria-label`, `aria-expanded`, `aria-controls` on interactive elements | WCAG 4.1.2 |

### Dropdown Keyboard Behavior

`dropdown-menu.tsx` uses `@base-ui/react/menu` which provides:

- Arrow Up/Down to navigate items
- Enter to select
- Escape to close
- Tab to exit and move focus forward

---

## shadcn/ui Usage Guidelines

1. **Install via CLI only**: `npx shadcn@latest add <name>` from `web/`. Do not copy-paste shadcn source manually.
2. **After every `shadcn add`**, verify these three files were not corrupted (shadcn sometimes regenerates them):
   - `src/components/ui/Button.tsx` — must be the TCMS version (no `buttonVariants` export)
   - `src/lib/utils.ts` — must re-export from `./cn`, not define its own `cn`
   - `src/index.css` — must retain TCMS token blocks and shadcn bridge vars
3. **Do not use shadcn's `@layer base`** block — it conflicts with TCMS body/html styles and the custom font setup.
4. **Do not use shadcn's font imports** — TCMS uses IBM Plex Sans + JetBrains Mono via `--font-sans` / `--font-mono` tokens.
5. **Path alias required**: `@/*` → `./src/*` must appear in both `tsconfig.json` (root) and `tsconfig.app.json`, plus `resolve.alias` in `vite.config.ts`. shadcn reads the root `tsconfig.json`.
6. **`ignoreDeprecations: "5.0"`** is required in `tsconfig.app.json` to suppress the TypeScript `baseUrl` deprecation warning (TS 5.0+).
