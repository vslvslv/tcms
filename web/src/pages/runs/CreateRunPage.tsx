import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../../ProjectContext";
import { api, type Run, type Suite, type Milestone, type TestPlan, type ConfigGroup } from "../../api";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { PageTitle } from "../../components/ui/PageTitle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/Select";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";

export default function CreateRunPage() {
  const { projectId } = useProject();
  const navigate = useNavigate();
  const [suites, setSuites] = useState<Suite[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [configGroups, setConfigGroups] = useState<ConfigGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [suiteId, setSuiteId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [planId, setPlanId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [configOptionIds, setConfigOptionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    Promise.all([
      api<Suite[]>(`/api/projects/${projectId}/suites`),
      api<Milestone[]>(`/api/projects/${projectId}/milestones`),
      api<TestPlan[]>(`/api/projects/${projectId}/plans`),
      api<ConfigGroup[]>(`/api/projects/${projectId}/config-groups`),
    ])
      .then(([s, m, p, c]) => {
        setSuites(s);
        setMilestones(m);
        setPlans(p);
        setConfigGroups(c);
        if (s.length === 1) setSuiteId(s[0].id);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [projectId]);

  function toggleConfigOption(id: string) {
    setConfigOptionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!suiteId || !name.trim()) return;
    setError("");
    setSaving(true);
    try {
      const run = await api<Run>(`/api/suites/${suiteId}/runs`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
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

  if (!projectId) {
    return (
      <div>
        <PageTitle className="mb-4">Add Test Run</PageTitle>
        <EmptyState
          message="Select a project from the sidebar to create a test run."
          action={<Button variant="primary" onClick={() => navigate("/projects")}>View projects</Button>}
        />
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  if (suites.length === 0) {
    return (
      <div>
        <PageTitle className="mb-4">Add Test Run</PageTitle>
        <EmptyState
          message="This project has no suites. Create a suite first from the project page."
          action={<Button variant="primary" onClick={() => navigate(`/projects/${projectId}`)}>Go to project</Button>}
        />
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <PageTitle className="mb-4">Add Test Run</PageTitle>
      {error && <p className="mb-4 text-error">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="create-run-form">
        <div>
          <Label htmlFor="suite">Suite</Label>
          <Select value={suiteId} onValueChange={setSuiteId} required>
            <SelectTrigger id="suite" className="mt-1 w-full">
              <SelectValue placeholder="— Select suite —" />
            </SelectTrigger>
            <SelectContent>
              {suites.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full" />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary"
          />
        </div>
        {plans.length > 0 && (
          <div>
            <Label htmlFor="plan">Test plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger id="plan" className="mt-1 w-full">
                <SelectValue placeholder="— None —" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {milestones.length > 0 && (
          <div>
            <Label htmlFor="milestone">Milestone</Label>
            <Select value={milestoneId} onValueChange={setMilestoneId}>
              <SelectTrigger id="milestone" className="mt-1 w-full">
                <SelectValue placeholder="— None —" />
              </SelectTrigger>
              <SelectContent>
                {milestones.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {configGroups.length > 0 && (
          <div>
            <Label>Configurations</Label>
            <div className="mt-2 space-y-1">
              {configGroups.map((g) => (
                <div key={g.id}>
                  <span className="text-sm font-medium text-muted-foreground">{g.name}:</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {g.options?.map((o) => (
                      <label key={o.id} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={configOptionIds.includes(o.id)}
                          onChange={() => toggleConfigOption(o.id)}
                          className="rounded border-border"
                        />
                        {o.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "Creating…" : "Create run"}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/runs/overview")}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
