import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type DashboardData = {
  projects: { id: string; name: string }[];
  milestones: { id: string; projectId: string; name: string; dueDate: string | null }[];
  plans: { id: string; projectId: string; name: string; milestoneId: string | null }[];
  recentRuns: { id: string; name: string; suiteId: string; projectId?: string; createdAt: string }[];
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!data) return null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 24 }}>
        <Link to="/projects">Projects</Link> → Dashboard
      </header>
      <section style={{ marginBottom: 32 }}>
        <h2>Projects</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {data.projects.map((p) => (
            <li key={p.id} style={{ marginBottom: 4 }}>
              <Link to={`/projects/${p.id}`}>{p.name}</Link>
              {" "}
              <Link to={`/projects/${p.id}/settings`} style={{ fontSize: 12 }}>Settings</Link>
            </li>
          ))}
        </ul>
        {data.projects.length === 0 && <p>No projects.</p>}
      </section>
      <section style={{ marginBottom: 32 }}>
        <h2>Milestones</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {data.milestones.map((m) => (
            <li key={m.id} style={{ marginBottom: 4 }}>
              <Link to={`/milestones/${m.id}/progress`}>{m.name}</Link>
              {m.dueDate && <span style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>Due: {m.dueDate}</span>}
            </li>
          ))}
        </ul>
        {data.milestones.length === 0 && <p>No milestones.</p>}
      </section>
      <section style={{ marginBottom: 32 }}>
        <h2>Test plans</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {data.plans.map((p) => (
            <li key={p.id} style={{ marginBottom: 4 }}>
              <Link to={`/plans/${p.id}/summary`}>{p.name}</Link>
            </li>
          ))}
        </ul>
        {data.plans.length === 0 && <p>No plans.</p>}
      </section>
      <section style={{ marginBottom: 32 }}>
        <h2>Recent runs</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {data.recentRuns.map((r) => (
            <li key={r.id} style={{ marginBottom: 4 }}>
              <Link to={`/runs/${r.id}`}>{r.name}</Link>
              <span style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>{new Date(r.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
        {data.recentRuns.length === 0 && <p>No runs yet.</p>}
      </section>
    </div>
  );
}
