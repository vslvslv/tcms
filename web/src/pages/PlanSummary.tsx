import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type TestPlan, type Run } from "../api";

type RunSummary = { run: Run; summary: { passed: number; failed: number; blocked: number; skipped: number; untested: number } };
type PlanSummaryData = { plan: TestPlan; runs: RunSummary[] };

export default function PlanSummary() {
  const { planId } = useParams<{ planId: string }>();
  const [data, setData] = useState<PlanSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!planId) return;
    api<PlanSummaryData>(`/api/plans/${planId}/summary`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [planId]);

  if (!planId) return null;
  if (loading) return <p>Loading…</p>;
  if (error || !data) return <p style={{ color: "red" }}>{error || "Not found"}</p>;

  const { plan, runs } = data;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 24 }}>
        <Link to={`/projects/${plan.projectId}`}>Project</Link> → <strong>Plan: {plan.name}</strong>
      </header>
      <h2>{plan.name}</h2>
      {plan.description && <p style={{ color: "#666" }}>{plan.description}</p>}
      <section style={{ marginTop: 24 }}>
        <h3>Runs ({runs.length})</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {runs.map(({ run, summary }) => {
            const total = summary.passed + summary.failed + summary.blocked + summary.skipped + summary.untested;
            return (
              <li key={run.id} style={{ marginBottom: 12, padding: 8, border: "1px solid #eee" }}>
                <Link to={`/runs/${run.id}`}>{run.name}</Link>
                {run.isCompleted && <span style={{ marginLeft: 8, color: "green" }}>Completed</span>}
                {total > 0 && (
                  <span style={{ marginLeft: 8, color: "#666" }}>
                    P: {summary.passed} F: {summary.failed} B: {summary.blocked} S: {summary.skipped} U: {summary.untested}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {runs.length === 0 && <p>No runs in this plan yet.</p>}
      </section>
    </div>
  );
}
