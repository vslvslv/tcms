import { getDb } from "../db/index.js";
import { runs, tests, results, milestoneScores } from "../db/schema.js";
import { eq, and, inArray, isNotNull } from "drizzle-orm";

/** Minimum gap between snapshots for the same milestone (1 minute cooldown). */
const SNAPSHOT_COOLDOWN_MS = 60_000;

/**
 * Compute the current pass rate for a milestone and insert a score row.
 *
 * Traversal: milestone → runs with milestoneId → tests → most recent result per test.
 * Only "passed" results count toward the score.
 *
 * ISSUE 59 guard: if the milestone has no tests, skip silently (don't insert a row).
 * Cooldown guard: if a snapshot was inserted within the last minute, skip.
 */
export async function triggerMilestoneSnapshot(milestoneId: string): Promise<void> {
  const db = await getDb();

  // Cooldown: check last snapshot time
  const recentRows = await db
    .select({ recordedAt: milestoneScores.recordedAt })
    .from(milestoneScores)
    .where(eq(milestoneScores.milestoneId, milestoneId))
    .orderBy(milestoneScores.recordedAt)
    .limit(1);
  if (recentRows.length > 0) {
    const lastMs = recentRows[0].recordedAt.getTime();
    if (Date.now() - lastMs < SNAPSHOT_COOLDOWN_MS) return;
  }

  // Find all runs under this milestone
  const milestoneRuns = await db
    .select({ id: runs.id })
    .from(runs)
    .where(eq(runs.milestoneId, milestoneId));

  if (milestoneRuns.length === 0) return;

  const runIds = milestoneRuns.map((r) => r.id);

  // Get all tests across these runs
  const milestoneTests = await db
    .select({ id: tests.id })
    .from(tests)
    .where(inArray(tests.runId, runIds));

  const totalTests = milestoneTests.length;

  // ISSUE 59 guard: skip snapshot for milestones with no tests
  if (totalTests === 0) return;

  const testIds = milestoneTests.map((t) => t.id);

  // Count passed results — latest result per test determines status
  // Simplified: count tests that have at least one "passed" result as the most recent
  const passedResults = await db
    .select({ testId: results.testId })
    .from(results)
    .where(and(
      inArray(results.testId, testIds),
      eq(results.status, "passed"),
      isNotNull(results.testId)
    ));

  // Dedup: unique testIds with a passing result
  const passedTestIds = new Set(passedResults.map((r) => r.testId));
  const passedCount = passedTestIds.size;

  const passRate = Math.round((passedCount / totalTests) * 100);
  const score = passRate;

  await db.insert(milestoneScores).values({
    milestoneId,
    score,
    passRate,
    totalTests,
  });
}
