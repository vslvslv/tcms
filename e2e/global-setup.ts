import { execSync } from "child_process";
import * as path from "path";

/**
 * Ensures E2E test data exists by running the Backoffice seed.
 * Requires: API database running and at least one user (e.g. from api npm run db:seed).
 * Run from repo root.
 */
async function globalSetup() {
  const apiDir = path.resolve(__dirname, "../api");
  try {
    execSync("npm run db:seed:backoffice", {
      cwd: apiDir,
      stdio: "inherit",
      env: { ...process.env },
    });
  } catch (e) {
    console.error("E2E global setup: seed-backoffice failed. Ensure DB is running and a user exists (api: npm run db:seed).");
    throw e;
  }
}

export default globalSetup;
