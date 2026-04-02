#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
npx tsx src/db/migrate.ts

echo "[entrypoint] Seeding default user..."
npx tsx src/db/seed.ts || true

echo "[entrypoint] Ensuring S3 bucket exists..."
npx tsx src/lib/ensureBucket.ts || true

echo "[entrypoint] Starting API dev server..."
exec npx tsx watch src/index.ts
