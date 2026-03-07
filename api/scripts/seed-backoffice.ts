/**
 * Seed script for the "Backoffice" project with ~500 cases across sections and subsections.
 * Uses its own DB connection and closes it when done, so it does not affect the running API.
 *
 * Usage:
 *   Seed:   npx tsx scripts/seed-backoffice.ts
 *   Clean:  npx tsx scripts/seed-backoffice.ts --clean
 *
 * Requires: DATABASE_URL (or default postgresql://postgres:postgres@localhost:5432/tcms) and at least one user.
 * Run `npm run db:seed` first if no user exists.
 */

import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
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

const { projects, suites, sections, testCases, testSteps, users } = schema;

const PROJECT_NAME = "Backoffice";

const ROOT_SECTIONS: { name: string; subsections: string[] }[] = [
  { name: "CRM", subsections: ["Contacts", "Deals", "Activities", "Reports"] },
  {
    name: "Billing",
    subsections: ["Invoices", "Payments", "Subscriptions", "Tax"],
  },
  {
    name: "Dealing",
    subsections: ["Orders", "Inventory", "Shipping"],
  },
  {
    name: "Administrations",
    subsections: ["Users", "Roles", "Settings", "Audit"],
  },
];

const TOTAL_CASES = 500;

function pickStatus(): "draft" | "ready" | "approved" {
  const r = Math.random();
  if (r < 0.4) return "draft";
  if (r < 0.8) return "ready";
  return "approved";
}

function caseTitle(area: string, index: number): string {
  const verbs = [
    "View",
    "Create",
    "Edit",
    "Delete",
    "Search",
    "Filter",
    "Export",
    "Validate",
    "Submit",
    "Cancel",
  ];
  const noun = area.replace(/\s+/g, " ");
  const verb = verbs[index % verbs.length];
  return `${verb} ${noun} – ${index + 1}`;
}

async function seed(db: Awaited<ReturnType<typeof drizzle>>) {

  const [user] = await db.select().from(users).limit(1);
  if (!user) {
    throw new Error(
      "No user found. Run 'npm run db:seed' first to create an admin user."
    );
  }

  const existing = await db
    .select()
    .from(projects)
    .where(eq(projects.name, PROJECT_NAME))
    .limit(1);
  if (existing.length > 0) {
    console.log(`Project "${PROJECT_NAME}" already exists. Use --clean first to remove it.`);
    process.exit(0);
  }

  const [project] = await db
    .insert(projects)
    .values({
      name: PROJECT_NAME,
      description: "Backoffice test project (seeded)",
      userId: user.id,
      suiteMode: "single",
    })
    .returning();
  if (!project) throw new Error("Failed to create project");
  console.log(`Created project: ${project.name}`);

  const [suite] = await db
    .insert(suites)
    .values({
      projectId: project.id,
      name: "Main suite",
      description: null,
    })
    .returning();
  if (!suite) throw new Error("Failed to create suite");
  console.log("Created suite: Main suite");

  const sectionIds: string[] = [];
  const sectionIdToName: Map<string, string> = new Map();

  for (const root of ROOT_SECTIONS) {
    const [rootSec] = await db
      .insert(sections)
      .values({
        suiteId: suite.id,
        parentId: null,
        name: root.name,
      })
      .returning();
    if (!rootSec) throw new Error(`Failed to create section ${root.name}`);
    sectionIds.push(rootSec.id);
    sectionIdToName.set(rootSec.id, root.name);

    for (const subName of root.subsections) {
      const [subSec] = await db
        .insert(sections)
        .values({
          suiteId: suite.id,
          parentId: rootSec.id,
          name: subName,
        })
        .returning();
      if (!subSec) throw new Error(`Failed to create subsection ${subName}`);
      sectionIds.push(subSec.id);
      sectionIdToName.set(subSec.id, `${root.name} › ${subName}`);
    }
  }

  const numSections = sectionIds.length;
  const casesPerSection = Math.floor(TOTAL_CASES / numSections);
  let remainder = TOTAL_CASES - casesPerSection * numSections;

  let totalInserted = 0;
  for (let i = 0; i < sectionIds.length; i++) {
    const sectionId = sectionIds[i];
    const areaName = sectionIdToName.get(sectionId) ?? "Section";
    let count = casesPerSection + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;

    for (let c = 0; c < count; c++) {
      const [tc] = await db
        .insert(testCases)
        .values({
          sectionId,
          title: caseTitle(areaName, c),
          prerequisite: null,
          sortOrder: c,
          status: pickStatus(),
        })
        .returning();
      if (tc) {
        await db.insert(testSteps).values({
          testCaseId: tc.id,
          content: `Perform action for: ${areaName}`,
          expected: "Expected result as per requirements",
          sortOrder: 0,
        });
        totalInserted++;
      }
    }
  }

  console.log(`Created ${sectionIds.length} sections and ${totalInserted} test cases.`);
}

async function clean(db: Awaited<ReturnType<typeof drizzle>>) {

  const existing = await db
    .select()
    .from(projects)
    .where(eq(projects.name, PROJECT_NAME))
    .limit(1);
  if (existing.length === 0) {
    console.log(`Project "${PROJECT_NAME}" not found. Nothing to clean.`);
    process.exit(0);
  }

  await db.delete(projects).where(eq(projects.id, existing[0].id));
  console.log(`Removed project "${PROJECT_NAME}" and all its suites, sections, and cases.`);
}

async function main() {
  const cleanMode = process.argv.includes("--clean");
  await withDb(async (db) => {
    if (cleanMode) {
      await clean(db);
    } else {
      await seed(db);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
