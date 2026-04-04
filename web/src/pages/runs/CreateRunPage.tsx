import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../../ProjectContext";
import { api, type Run, type Suite, type Milestone, type TestPlan, type ConfigGroup, type SuggestedTest } from "../../api";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { PageTitle } from "../../components/ui/PageTitle";
import { Select } from "../../components/ui/Select";
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

  // Smart run state
  const [smartOpen, setSmartOpen] = useState(false);
  const [changedFiles, setChangedFiles] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestedTest[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");

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

  async function findTests() {
    if (!projectId || !changedFiles.trim()) return;
    setSuggestLoading(true);
    setSuggestError("");
    setSuggestions(null);
    const files = changedFiles.split("\n").map((f) => f.trim()).filter(Boolean).join(",");
    try {
      const data = await api<SuggestedTest[]>(`/api/projects/${projectId}/suggest-tests?changedFiles=${encodeURIComponent(files)}`);
      setSuggestions(data);
    } catch {
      setSuggestError("Smart selection unavailable right now.");
    } finally {
      setSuggestLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {    e.preventDefault();
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
        {/* Smart selection (optional) */}
        <div className="rounded border border-border bg-surface">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-text hover:bg-surface-raised"
            onClick={() => setSmartOpen((v) => !v)}
            aria-expanded={smartOpen}
          >
            <span>Smart selection (optional)</span>
            <span className="text-muted">{smartOpen ? "▲" : "▼"}</span>
          </button>
          {smartOpen && (
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
              <Label htmlFor="changed-files">Changed file paths (one per line)</Label>
              <textarea
                id="changed-files"
                value={changedFiles}
                onChange={(e) => setChangedFiles(e.target.value)}
                rows={4}
                placeholder="e.g. src/auth/login.ts"
                className="mt-1 w-full rounded border border-border bg-surface-raised text-text px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary"
              />
              <Button
                type="button"
                variant="primary"
                onClick={findTests}
                disabled={suggestLoading || !changedFiles.trim()}
              >
                {suggestLoading ? "Finding tests…" : "Find tests"}
              </Button>
              {suggestError && <p className="text-sm text-error">{suggestError}</p>}
              {suggestions !== null && suggestions.length === 0 && (
                <p className="text-sm text-muted">No test suggestions — run CI with file tracking to build correlation data.</p>
              )}
              {suggestions && suggestions.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {suggestions.map((s) => (
                    <li key={s.caseId} className="flex items-center gap-2 rounded border border-border px-3 py-2 bg-surface-raised">
                      <span className="font-medium text-text">{s.caseTitle}</span>
                      <span className="text-xs text-muted ml-auto">{s.score} run{s.score !== 1 ? "s" : ""} correlated</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="suite">Suite</Label>
          <Select id="suite" value={suiteId} onChange={(e) => setSuiteId(e.target.value)} required className="mt-1 w-full">
            <option value="">— Select suite —</option>
            {suites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
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
            className="mt-1 w-full rounded border border-border bg-surface-raised text-text px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary"
          />
        </div>
        {plans.length > 0 && (
          <div>
            <Label htmlFor="plan">Test plan</Label>
            <Select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)} className="mt-1 w-full">
              <option value="">— None —</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
        )}
        {milestones.length > 0 && (
          <div>
            <Label htmlFor="milestone">Milestone</Label>
            <Select id="milestone" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} className="mt-1 w-full">
              <option value="">— None —</option>
              {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </div>
        )}
        {configGroups.length > 0 && (
          <div>
            <Label>Configurations</Label>
            <div className="mt-2 space-y-1">
              {configGroups.map((g) => (
                <div key={g.id}>
                  <span className="text-sm font-medium text-muted">{g.name}:</span>
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
