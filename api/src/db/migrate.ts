import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/**
 * Standalone migration runner for the API.
 *
 * Uses the same connection-string logic as src/db/index.ts:
 * - Prefer DATABASE_URL from .env
 * - Otherwise default to a local Docker postgres instance:
 *   postgresql://postgres:postgres@localhost:5432/tcms
 * - If DATABASE_URL points at localhost:5432 without credentials,
 *   fall back to the Docker-style URL so SCRAM auth always has a password.
 */
const DEFAULT_DOCKER_URL = "postgresql://postgres:postgres@localhost:5432/tcms";

function getConnectionString(): string {
  let s = process.env.DATABASE_URL?.trim() || DEFAULT_DOCKER_URL;
  if (s.includes("localhost:5432") && !s.includes("@localhost")) {
    s = DEFAULT_DOCKER_URL;
  }
  return s;
}

async function runMigrations() {
  const connectionString = getConnectionString();
  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("Migrations complete");
  } finally {
    await client.end().catch(() => {
      // ignore close errors on shutdown
    });
  }
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
