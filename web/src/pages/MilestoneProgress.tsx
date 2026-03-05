import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Milestone } from "../api";

type Progress = {
  milestone: Milestone;
  runsCount: number;
  completedRuns: number;
  summary: { passed: number; failed: number; blocked: number; skipped: number; untested: number };
};

export default function MilestoneProgress() {
  const { milestoneId } = useParams<{ milestoneId: string }>();
  const [data, setData] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!milestoneId) return;
    api<Progress>(`/api/milestones/${milestoneId}/progress`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [milestoneId]);

  if (!milestoneId) return null;
  if (loading) return <p>Loading…</p>;
  if (error || !data) return <p style={{ color: "red" }}>{error || "Not found"}</p>;

  const { milestone, runsCount, completedRuns, summary } = data;
  const total = summary.passed + summary.failed + summary.blocked + summary.skipped + summary.untested;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 24 }}>
        <Link to={`/projects/${milestone.projectId}`}>Project</Link> → <strong>Milestone: {milestone.name}</strong>
      </header>
      <h2>{milestone.name}</h2>
      {milestone.description && <p style={{ color: "#666" }}>{milestone.description}</p>}
      {milestone.dueDate && <p>Due: {new Date(milestone.dueDate).toLocaleDateString()}</p>}
      <section style={{ marginTop: 24 }}>
        <h3>Progress</h3>
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
      </section>
    </div>
  );
}
