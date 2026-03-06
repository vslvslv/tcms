import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export default function ShareView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`${baseUrl}/api/shares/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) return null;
  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!data) return null;

  const d = data as Record<string, unknown>;
  if (d.plan && Array.isArray(d.runs)) {
    const plan = d.plan as { name: string; description?: string };
    const runs = d.runs as { run: { id: string; name: string; isCompleted: boolean }; summary: Record<string, number> }[];
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
        <h1>Shared: {plan.name}</h1>
        {plan.description && <p style={{ color: "#666" }}>{plan.description}</p>}
        <h2>Runs ({runs.length})</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {runs.map(({ run, summary }) => {
            const total = Object.values(summary).reduce((a, b) => a + b, 0);
            return (
              <li key={run.id} style={{ marginBottom: 12, padding: 8, border: "1px solid #eee" }}>
                {run.name}
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
      </div>
    );
  }
  if (d.milestone && typeof d.runsCount === "number") {
    const milestone = d.milestone as { name: string; description?: string; dueDate?: string };
    const summary = d.summary as Record<string, number>;
    const runsCount = d.runsCount as number;
    const completedRuns = d.completedRuns as number;
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
        <h1>Shared: {milestone.name}</h1>
        {milestone.description && <p style={{ color: "#666" }}>{milestone.description}</p>}
        {milestone.dueDate && <p>Due: {new Date(milestone.dueDate).toLocaleDateString()}</p>}
        <h2>Progress</h2>
        <p>Runs: {completedRuns} / {runsCount} completed</p>
        {total > 0 && (
          <ul style={{ listStyle: "none", padding: 0 }}>
            <li>Passed: {summary.passed}</li>
            <li>Failed: {summary.failed}</li>
            <li>Blocked: {summary.blocked}</li>
            <li>Skipped: {summary.skipped}</li>
            <li>Untested: {summary.untested}</li>
          </ul>
        )}
      </div>
    );
  }
  return <p>Invalid share data.</p>;
}
