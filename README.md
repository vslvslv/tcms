# tcms

Test Case Management System — a TestRail-like platform for managing test cases, runs, plans and results.

## Getting started

See **[docs/setup.md](docs/setup.md)** for database setup, env vars, and running the API and web app.

**Quick start (with PostgreSQL running):**
```bash
cd api && npm install && npm run db:migrate && npm run db:seed && npm run dev
cd web && npm install && npm run dev
```
Then open http://localhost:5001 and log in as `admin@tcms.local` / `password123`, or register a new user.

## Project docs

- **[REPLICATION_PLAN.md](REPLICATION_PLAN.md)** — Goal, data model, feature tiers and phased implementation.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Architecture tooling, C4 diagrams and high-level design.