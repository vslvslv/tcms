import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api, type Project, type Suite, type Milestone, type TestPlan } from "../api";

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { logout } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewSuite, setShowNewSuite] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState("");
  const [showNewMilestone, setShowNewMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [newMilestoneDue, setNewMilestoneDue] = useState("");
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanMilestoneId, setNewPlanMilestoneId] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    if (!projectId) return;
    Promise.all([
      api<Project>(`/api/projects/${projectId}`),
      api<Suite[]>(`/api/projects/${projectId}/suites`),
      api<Milestone[]>(`/api/projects/${projectId}/milestones`),
      api<TestPlan[]>(`/api/projects/${projectId}/plans`),
    ])
      .then(([p, s, m, pl]) => {
        setProject(p);
        setSuites(s);
        setMilestones(m);
        setPlans(pl);
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

  async function createMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !newMilestoneName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api<Milestone>(`/api/projects/${projectId}/milestones`, {
        method: "POST",
        body: JSON.stringify({
          name: newMilestoneName.trim(),
          dueDate: newMilestoneDue.trim() || undefined,
        }),
      });
      setNewMilestoneName("");
      setNewMilestoneDue("");
      setShowNewMilestone(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create milestone");
    } finally {
      setSaving(false);
    }
  }

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !newPlanName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api<TestPlan>(`/api/projects/${projectId}/plans`, {
        method: "POST",
        body: JSON.stringify({
          name: newPlanName.trim(),
          milestoneId: newPlanMilestoneId.trim() || null,
        }),
      });
      setNewPlanName("");
      setNewPlanMilestoneId("");
      setShowNewPlan(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
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
          {" "}
          <Link to={`/projects/${projectId}/settings`} style={{ marginLeft: 8 }}>Settings</Link>
        </div>
        <button type="button" onClick={logout}>Log out</button>
      </header>

      <section style={{ marginBottom: 32 }}>
        <h2>Milestones</h2>
        {showNewMilestone && (
          <form onSubmit={createMilestone} style={{ marginBottom: 16, padding: 16, border: "1px solid #ccc" }}>
            <label>Name <input value={newMilestoneName} onChange={(e) => setNewMilestoneName(e.target.value)} required /></label>
            <label style={{ marginLeft: 12 }}>Due date <input type="date" value={newMilestoneDue} onChange={(e) => setNewMilestoneDue(e.target.value)} /></label>
            <button type="submit" disabled={saving}>Create</button>
            <button type="button" onClick={() => { setShowNewMilestone(false); setNewMilestoneName(""); setNewMilestoneDue(""); }}>Cancel</button>
          </form>
        )}
        {!showNewMilestone && <button type="button" onClick={() => setShowNewMilestone(true)}>New milestone</button>}
        <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
          {milestones.map((m) => (
            <li key={m.id} style={{ marginBottom: 4 }}>
              <Link to={`/milestones/${m.id}/progress`}>{m.name}</Link>
              {m.dueDate && <span style={{ color: "#666", marginLeft: 8 }}>Due: {new Date(m.dueDate).toLocaleDateString()}</span>}
            </li>
          ))}
        </ul>
        {milestones.length === 0 && !showNewMilestone && <p style={{ color: "#666" }}>No milestones.</p>}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Test plans</h2>
        {showNewPlan && (
          <form onSubmit={createPlan} style={{ marginBottom: 16, padding: 16, border: "1px solid #ccc" }}>
            <label>Name <input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} required /></label>
            <label style={{ marginLeft: 12 }}>Milestone
              <select value={newPlanMilestoneId} onChange={(e) => setNewPlanMilestoneId(e.target.value)}>
                <option value="">— None —</option>
                {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <button type="submit" disabled={saving}>Create</button>
            <button type="button" onClick={() => { setShowNewPlan(false); setNewPlanName(""); setNewPlanMilestoneId(""); }}>Cancel</button>
          </form>
        )}
        {!showNewPlan && <button type="button" onClick={() => setShowNewPlan(true)}>New plan</button>}
        <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
          {plans.map((p) => (
            <li key={p.id} style={{ marginBottom: 4 }}>
              <Link to={`/plans/${p.id}/summary`}>{p.name}</Link>
            </li>
          ))}
        </ul>
        {plans.length === 0 && !showNewPlan && <p style={{ color: "#666" }}>No test plans.</p>}
      </section>

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
