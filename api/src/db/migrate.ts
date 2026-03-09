import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const DEFAULT_DOCKER_URL = "postgresql://postgres:postgres@localhost:5432/tcms";
let connectionString = process.env.DATABASE_URL?.trim() || DEFAULT_DOCKER_URL;
// If URL has no credentials (e.g. postgresql://localhost:5432/tcms), use default so SCRAM gets a string password
if (
  connectionString.includes("localhost:5432") &&
  !connectionString.includes("@localhost")
) {
  connectionString = DEFAULT_DOCKER_URL;
}

async function run() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./migrations" });
  await client.end();
  console.log("Migrations complete");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
