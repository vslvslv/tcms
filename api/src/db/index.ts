import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/tcms";

const client = new pg.Client({ connectionString });

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
