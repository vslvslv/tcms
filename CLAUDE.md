# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

TCMS is a TestRail-like test case management system built as a monorepo with three packages: `api/` (Fastify + PostgreSQL), `web/` (React + Vite), and `e2e/` (Playwright).

## Commands

### Docker (recommended)
```bash
docker compose up --build    # Start all services (db + api + web) with hot reload
docker compose down          # Stop all services
docker compose down -v       # Stop and delete database volume
docker compose logs api      # View API logs
docker compose exec api sh   # Shell into API container
docker compose exec db psql -U postgres tcms  # Connect to PostgreSQL
```
On first run, the API container automatically runs migrations and seeds the default user (`admin@tcms.local` / `password123`).

### API (`cd api`)
```bash
npm run dev               # Start Fastify dev server on :3001 with hot reload (tsx watch)
npm run build             # Compile TypeScript to dist/
npm start                 # Run compiled API
npm run db:migrate        # Run pending Drizzle migrations
npm run db:seed           # Seed default user (admin@tcms.local / password123)
npm run db:seed:backoffice  # Seed 500+ test cases for testing
npm run db:cleanup:e2e    # Remove E2E test data
```

### Web (`cd web`)
```bash
npm run dev       # Start Vite dev server on :5001 with HMR
npm run build     # Production build to dist/
npm run lint      # ESLint
npm run preview   # Preview production build
```

### E2E (from repo root)
```bash
npm run test:e2e           # All tests (headless)
npm run test:e2e:ui        # Interactive Playwright UI
npm run test:e2e:headed    # Watch in browser
npx playwright test e2e/specs/auth.spec.ts   # Single spec file
npx playwright test --project=chromium-unauth  # Unauthenticated tests only
```

### Environment
**`api/.env`**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tcms
JWT_SECRET=change-me-in-production
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5001
# S3/MinIO (file attachments)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=tcms-attachments
# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/oauth/google/callback
# Email notifications (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@tcms.local
```
**`web/.env`**
```
VITE_API_URL=http://localhost:3001
```

## Architecture

### Data Model Hierarchy
```
Project → Suite → Section (tree) → TestCase → TestStep
                                 → Run → Test (case-in-run) → Result
Project → Milestone → TestPlan → PlanEntry
```
Key supplementary tables: `ConfigGroups`, `CaseFields` (JSONB custom fields), `SharedSteps`, `CaseTemplates`, `Datasets`, `AuditLog`, `Webhooks`, `Attachments`, `ApiTokens`, `ShareTokens`, `PasswordResetTokens`, `FileFailureCorrelations`, `NotificationPreferences`.

The complete schema lives in **`api/src/db/schema.ts`** — this is the single source of truth for all entities and their relationships.

### API (`api/src/`)
- **`index.ts`** — Server bootstrap: registers all routes, JWT plugin, CORS, multipart
- **`routes/`** — One file per entity (31 files). Each file registers its own Fastify routes
- **`lib/projectAccess.ts`** — Call `assertProjectAccess(req, projectId)` on every project-scoped route for authorization
- **`lib/permissions.ts`** — Fine-grained `can(userId, projectId, action)` permission checks (admin/lead/tester matrix)
- **`lib/errors.ts`** — `replyError()` for consistent error responses
- **`lib/auditLog.ts`** / **`lib/webhooks.ts`** — Side effects on mutations
- **`lib/storage.ts`** — S3-compatible file storage (MinIO in dev)
- **`lib/email.ts`** — SMTP email sending via nodemailer

Authentication: JWT via `fastify-jwt`. All protected routes call `await request.jwtVerify()` via the `authenticate` decorator. Google OAuth available via `/api/auth/oauth/google/authorize` (requires GOOGLE_CLIENT_ID env var). API token auth via `tcms_` prefixed tokens (SHA-256 hashed, 90-day expiry).

### Web (`web/src/`)
- **`App.tsx`** — React Router v7 tree; authenticated routes are wrapped in `<RequireAuth>`
- **`api.ts`** — Central API client (`api()` function) + all TypeScript types exported from here. When adding new endpoints, add types here too
- **`AuthContext.tsx`** — JWT token stored in `localStorage`, user state
- **`ProjectContext.tsx`** — Currently selected project (persisted to `localStorage`)
- **`pages/`** — One file per route/view
- **`components/ui/`** — Reusable UI primitives (buttons, modals, etc.)

Styling: Tailwind CSS 4 via `@tailwindcss/vite` plugin. Use `cn()` from `lib/cn.ts` (tailwind-merge) for conditional classes.

### E2E (`e2e/`)
- **`global-setup.ts`** — Seeds the "Backoffice" project with 500 test cases before the suite runs
- **`specs/auth.setup.ts`** — Logs in and saves auth state to `e2e/.auth/`
- **`pages/`** — Page Object Model; one class per page
- Playwright config has 3 projects: `setup` (auth), `chromium` (authenticated), `chromium-unauth`

## Key Patterns

- **Adding a new entity:** Add table to `api/src/db/schema.ts` → generate migration (`npx drizzle-kit generate`) → create `api/src/routes/<entity>.ts` → register in `api/src/index.ts` → add types + API calls to `web/src/api.ts`
- **Route authorization:** Call `assertProjectAccess(request, projectId)` for membership checks. Use `can(userId, projectId, action)` from `lib/permissions.ts` for fine-grained permission checks (e.g., `can(userId, projectId, "cases.delete")`)
- **Custom fields:** Stored as JSONB in `caseFields` / `templateSteps` / `datasetRows` columns — not individual columns
- **Migrations:** Auto-generated by Drizzle Kit from schema changes. Never edit migration files manually

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
