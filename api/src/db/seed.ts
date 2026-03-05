import bcrypt from "bcrypt";
import { getDb } from "./index.js";
import { users, roles } from "./schema.js";

async function run() {
  const db = await getDb();
  const existingRoles = await db.select().from(roles).limit(1);
  if (existingRoles.length === 0) {
    await db.insert(roles).values([
      { name: "admin" },
      { name: "lead" },
      { name: "tester" },
    ]);
    console.log("Seeded roles: admin, lead, tester");
  }
  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) {
    console.log("Seed already applied (user exists)");
    process.exit(0);
  }
  const passwordHash = await bcrypt.hash("password123", 10);
  await db.insert(users).values({
    email: "admin@tcms.local",
    passwordHash,
    name: "Admin",
  });
  console.log("Seeded user admin@tcms.local / password123");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
