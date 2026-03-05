import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api, type Project, type Suite } from "../api";

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { logout } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewSuite, setShowNewSuite] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    if (!projectId) return;
    Promise.all([
      api<Project>(`/api/projects/${projectId}`),
      api<Suite[]>(`/api/projects/${projectId}/suites`),
    ])
      .then(([p, s]) => {
        setProject(p);
        setSuites(s);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [projectId]);

  async function createSuite(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !newSuiteName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api<Suite>(`/api/projects/${projectId}/suites`, {
        method: "POST",
        body: JSON.stringify({ name: newSuiteName.trim() }),
      });
      setNewSuiteName("");
      setShowNewSuite(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create suite");
    } finally {
      setSaving(false);
    }
  }

  if (!projectId) return null;
  if (loading) return <p>Loading…</p>;
  if (error || !project) return <p style={{ color: "red" }}>{error || "Project not found"}</p>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <Link to="/projects">Projects</Link> → <strong>{project.name}</strong>
        </div>
        <button type="button" onClick={logout}>Log out</button>
      </header>
      <h2>Suites</h2>
      {showNewSuite && (
        <form onSubmit={createSuite} style={{ marginBottom: 16, padding: 16, border: "1px solid #ccc" }}>
          <label>Name <input value={newSuiteName} onChange={(e) => setNewSuiteName(e.target.value)} required /></label>
          <button type="submit" disabled={saving}>Create</button>
          <button type="button" onClick={() => { setShowNewSuite(false); setNewSuiteName(""); }}>Cancel</button>
        </form>
      )}
      {!showNewSuite && <button type="button" onClick={() => setShowNewSuite(true)}>New suite</button>}
      <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
        {suites.map((s) => (
          <li key={s.id} style={{ marginBottom: 8 }}>
            <Link to={`/suites/${s.id}`}>{s.name}</Link>
          </li>
        ))}
      </ul>
      {suites.length === 0 && <p>No suites. Add one via API or add “New suite” here.</p>}
    </div>
  );
}
