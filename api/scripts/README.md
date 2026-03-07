# Backoffice seed script

Seeds the database with a **Backoffice** project containing ~500 test cases across multiple sections and subsections.

## Prerequisites

- Database running and `DATABASE_URL` set (default: `postgresql://localhost:5432/tcms`)
- At least one user in the database (run `npm run db:seed` from the `api` folder first)

## Usage

From the `api` directory:

```bash
# Seed the Backoffice project (~500 cases)
npm run db:seed:backoffice

# Remove the Backoffice project and all its data
npm run db:seed:backoffice:clean
```

Or with `npx tsx`:

```bash
npx tsx scripts/seed-backoffice.ts        # seed
npx tsx scripts/seed-backoffice.ts --clean  # cleanup
```

## Structure created

- **Project:** Backoffice
- **Suite:** Main suite (single-suite mode)
- **Root sections:** CRM, Billing, Dealing, Administrations
- **Subsections:**
  - CRM: Contacts, Deals, Activities, Reports
  - Billing: Invoices, Payments, Subscriptions, Tax
  - Dealing: Orders, Inventory, Shipping
  - Administrations: Users, Roles, Settings, Audit
- **Cases:** 500 total, distributed across all sections/subsections, each with one test step. Status is randomly draft/ready/approved.
