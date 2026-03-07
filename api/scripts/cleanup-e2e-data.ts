/**
 * One-time cleanup of E2E test data (names starting with "E2E ").
 * Safe to run multiple times. Uses its own DB connection.
 *
 * Usage: npx tsx scripts/cleanup-e2e-data.ts
 *
 * Requires: DATABASE_URL (or default postgresql://postgres:postgres@localhost:5432/tcms)
 */

import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, like, sql } from "drizzle-orm";
import * as schema from "../src/db/schema.js";

const DEFAULT_DOCKER_URL = "postgresql://postgres:postgres@localhost:5432/tcms";

function getConnectionString(): string {
  let s = process.env.DATABASE_URL?.trim() || DEFAULT_DOCKER_URL;
  if (s.includes("localhost:5432") && !s.includes("@localhost")) {
    s = DEFAULT_DOCKER_URL;
  }
  return s;
}

async function withDb<T>(fn: (db: Awaited<ReturnType<typeof drizzle>>) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: getConnectionString() });
  try {
    await client.connect();
    const db = drizzle(client, { schema });
    return await fn(db);
  } finally {
    await client.end();
  }
}

const { projects, runs, sections, testCases } = schema;

async function cleanup(db: Awaited<ReturnType<typeof drizzle>>) {
  let totalDeleted = 0;

  const runsDeleted = await db.delete(runs).where(like(runs.name, "E2E Run %"));
  const r = (runsDeleted as { rowCount?: number }).rowCount ?? 0;
  if (r > 0) {
    console.log(`Deleted ${r} run(s) (E2E Run %)`);
    totalDeleted += r;
  }

  const casesDeleted = await db
    .delete(testCases)
    .where(
      sql`(title LIKE 'E2E Case %' OR title LIKE 'E2E Edited %' OR title LIKE 'E2E To Delete %')`
    );
  const c = (casesDeleted as { rowCount?: number }).rowCount ?? 0;
  if (c > 0) {
    console.log(`Deleted ${c} test case(s) (E2E Case / E2E Edited / E2E To Delete)`);
    totalDeleted += c;
  }

  for (let pass = 0; pass < 100; pass++) {
    const sectionsDeleted = await db
      .delete(sections)
      .where(
        sql`name LIKE 'E2E %' AND id NOT IN (SELECT parent_id FROM sections WHERE parent_id IS NOT NULL)`
      );
    const s = (sectionsDeleted as { rowCount?: number }).rowCount ?? 0;
    if (s === 0) break;
    console.log(`Deleted ${s} section(s) (E2E %, pass ${pass + 1})`);
    totalDeleted += s;
  }

  const projectsDeleted = await db.delete(projects).where(like(projects.name, "E2E Project %"));
  const p = (projectsDeleted as { rowCount?: number }).rowCount ?? 0;
  if (p > 0) {
    console.log(`Deleted ${p} project(s) (E2E Project %)`);
    totalDeleted += p;
  }

  if (totalDeleted === 0) {
    console.log("No E2E test data found.");
  } else {
    console.log(`Done. Removed ${totalDeleted} row(s) in total.`);
  }
}

withDb(cleanup).catch((e) => {
  console.error(e);
  process.exit(1);
});
