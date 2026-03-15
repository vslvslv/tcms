import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type Run, type Suite, type Milestone, type ConfigGroup } from "../api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/Select";

export default function CreateRun() {
  const { suiteId } = useParams<{ suiteId: string }>();
  const navigate = useNavigate();
  const [suite, setSuite] = useState<Suite | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [configGroups, setConfigGroups] = useState<ConfigGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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
          api<ConfigGroup[]>(`/api/projects/${s.projectId}/config-groups`),
        ]);
      })
      .then(([m, c]) => {
        setMilestones(m);
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
    <div style={{ maxWidth: 500, margin: 0 }}>
      <h1 style={{ margin: "0 0 16px 0" }}>Create run{suite ? ` — ${suite.name}` : ""}</h1>
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
        {milestones.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label>
              Milestone{" "}
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                <SelectContent>
                  {milestones.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
