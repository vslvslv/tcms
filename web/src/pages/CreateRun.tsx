import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type Run, type Suite, type Milestone, type TestPlan, type ConfigGroup } from "../api";

export default function CreateRun() {
  const { suiteId } = useParams<{ suiteId: string }>();
  const navigate = useNavigate();
  const [suite, setSuite] = useState<Suite | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [configGroups, setConfigGroups] = useState<ConfigGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [planId, setPlanId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [configOptionIds, setConfigOptionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!suiteId) return;
    api<Suite>(`/api/suites/${suiteId}`)
      .then((s) => {
        setSuite(s);
        return Promise.all([
          api<Milestone[]>(`/api/projects/${s.projectId}/milestones`),
          api<TestPlan[]>(`/api/projects/${s.projectId}/plans`),
          api<ConfigGroup[]>(`/api/projects/${s.projectId}/config-groups`),
        ]);
      })
      .then(([m, p, c]) => {
        setMilestones(m);
        setPlans(p);
        setConfigGroups(c);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [suiteId]);

  function toggleConfigOption(id: string) {
    setConfigOptionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!suiteId) return;
    setError("");
    setSaving(true);
    try {
      const run = await api<Run>(`/api/suites/${suiteId}/runs`, {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          planId: planId || undefined,
          milestoneId: milestoneId || undefined,
          configOptionIds: configOptionIds.length > 0 ? configOptionIds : undefined,
        }),
      });
      navigate(`/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create run");
    } finally {
      setSaving(false);
    }
  }

  if (!suiteId) return null;
  if (loading) return <p>Loading…</p>;

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 24 }}>
        <Link to={`/suites/${suiteId}`}>{suite?.name ?? "Suite"}</Link> → Create run
      </header>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Name <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: "100%" }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>
            Description <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ width: "100%" }} />
          </label>
        </div>
        {plans.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label>
              Test plan{" "}
              <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">— None —</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
        )}
        {milestones.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label>
              Milestone{" "}
              <select value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                <option value="">— None —</option>
                {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>
        )}
        {configGroups.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <span>Configurations</span>
            {configGroups.map((g) => (
              <div key={g.id} style={{ marginTop: 4 }}>
                <strong>{g.name}:</strong>{" "}
                {g.options?.map((o) => (
                  <label key={o.id} style={{ marginRight: 8 }}>
                    <input type="checkbox" checked={configOptionIds.includes(o.id)} onChange={() => toggleConfigOption(o.id)} /> {o.name}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
        <button type="submit" disabled={saving}>{saving ? "Creating…" : "Create run"}</button>
      </form>
    </div>
  );
}
