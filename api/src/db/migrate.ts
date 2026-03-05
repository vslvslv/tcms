import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/tcms";

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
