# TCMS setup

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (or use Docker below)
- npm (or pnpm)

## Docker Compose (recommended)

The easiest way to run everything:

```bash
docker compose up --build
```

This starts PostgreSQL, the API (with auto-migration and seeding), the web frontend, and MinIO (S3-compatible storage for file attachments). Open http://localhost:5001 and log in as `admin@tcms.local` / `password123`.

## Database

Create a database and set `DATABASE_URL`:

```bash
createdb tcms
export DATABASE_URL=postgresql://localhost:5432/tcms
```

Or with Docker:

```bash
docker run -d --name tcms-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tcms -p 5432:5432 postgres:16-alpine
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tcms
```

## API

```bash
cd api
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET

npm install
npm run db:migrate
npm run db:seed
npm run dev
```

API runs at http://localhost:3001. Health: http://localhost:3001/health.

**Seeded user:** `admin@tcms.local` / `password123`

## Web

```bash
cd web
cp .env.example .env
# Set VITE_API_URL=http://localhost:3001 if needed

npm install
npm run dev
```

Web runs at http://localhost:5001.

## Env reference

| Variable       | Where | Description |
|----------------|-------|-------------|
| DATABASE_URL   | api   | PostgreSQL connection string |
| JWT_SECRET     | api   | Secret for signing JWTs |
| PORT           | api   | API port (default 3001) |
| CORS_ORIGIN    | api   | Allowed origin for CORS (default http://localhost:5001) |
| S3_ENDPOINT    | api   | S3/MinIO endpoint for file attachments |
| S3_ACCESS_KEY  | api   | S3 access key |
| S3_SECRET_KEY  | api   | S3 secret key |
| S3_BUCKET      | api   | S3 bucket name (default tcms-attachments) |
| GOOGLE_CLIENT_ID | api | Google OAuth client ID (optional) |
| GOOGLE_CLIENT_SECRET | api | Google OAuth client secret (optional) |
| SMTP_HOST      | api   | SMTP server for email notifications (optional) |
| SMTP_PORT      | api   | SMTP port (default 587) |
| SMTP_FROM      | api   | Sender email address (default noreply@tcms.local) |
| VITE_API_URL   | web   | API base URL for fetch (default http://localhost:3001) |
