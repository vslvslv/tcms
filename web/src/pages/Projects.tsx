import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api, type Project } from "../api";

export default function Projects() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api<Project[]>("/api/projects")
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      setNewName("");
      setNewDesc("");
      setShowNew(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>
          <Link to="/dashboard" style={{ marginRight: 16 }}>Dashboard</Link>
          TCMS — Projects
        </h1>
        <div>
          {user?.name} <button type="button" onClick={logout}>Log out</button>
        </div>
      </header>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {showNew && (
        <form onSubmit={createProject} style={{ marginBottom: 16, padding: 16, border: "1px solid #ccc" }}>
          <div style={{ marginBottom: 8 }}>
            <label>Name <input value={newName} onChange={(e) => setNewName(e.target.value)} required /></label>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Description <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} /></label>
          </div>
          <button type="submit" disabled={saving}>Create</button>
          <button type="button" onClick={() => { setShowNew(false); setNewName(""); setNewDesc(""); }}>Cancel</button>
        </form>
      )}
      {!showNew && <button type="button" onClick={() => setShowNew(true)}>New project</button>}
      {loading && <p>Loading…</p>}
      {!loading && !error && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {projects.map((p) => (
            <li key={p.id} style={{ marginBottom: 8 }}>
              <Link to={`/projects/${p.id}`}>{p.name}</Link>
              {p.description && <span style={{ color: "#666", marginLeft: 8 }}>{p.description}</span>}
            </li>
          ))}
        </ul>
      )}
      {!loading && projects.length === 0 && !error && !showNew && <p>No projects yet.</p>}
    </div>
  );
}
