import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const DEFAULT_DOCKER_URL = "postgresql://postgres:postgres@localhost:5432/tcms";

let connectionString = process.env.DATABASE_URL?.trim() || DEFAULT_DOCKER_URL;
// If URL has no credentials (e.g. postgresql://localhost:5432/tcms), use Docker default so SCRAM auth gets a password
if (
  connectionString.includes("localhost:5432") &&
  !connectionString.includes("@localhost")
) {
  connectionString = DEFAULT_DOCKER_URL;
}

const client = new pg.Client({ connectionString });

// Prevent unhandled 'error' from crashing the process (e.g. connection drop, DB restart)
client.on("error", (err) => {
  console.error("[db] Client error:", err.message);
});

let connected = false;
export async function getDb() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  return drizzle(client, { schema });
}

export type Db = Awaited<ReturnType<typeof getDb>>;
export { schema };
