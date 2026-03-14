import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Flag, FolderOpen, Activity, Layers, ClipboardList } from "lucide-react";
import { api, type Project, type Suite, type Milestone, type TestPlan, type ProjectRun, type AuditLogEntry } from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageTitle } from "../components/ui/PageTitle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/Select";

function last7Days(): { date: string; displayDate: string }[] {
  const out: { date: string; displayDate: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    out.push({
      date,
      displayDate: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }),
    });
  }
  return out;
}

function runsByDay(runs: { createdAt?: string }[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const r of runs) {
    const d = r.createdAt?.slice(0, 10);
    if (d) byDate.set(d, (byDate.get(d) ?? 0) + 1);
  }
  return byDate;
}

const CHART_COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe", "#eff6ff"];

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [recentRuns, setRecentRuns] = useState<ProjectRun[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
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
      api<ProjectRun[]>(`/api/projects/${projectId}/runs?limit=50`),
    ])
      .then(([p, s, m, pl, runs]) => {
        setProject(p);
        setSuites(s);
        setMilestones(m);
        setPlans(pl);
        setRecentRuns(runs);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));

    api<AuditLogEntry[]>(`/api/projects/${projectId}/audit-log?limit=20`)
      .then(setAuditLog)
      .catch(() => setAuditLog([]));
  }

  useEffect(() => {
    load();
  }, [projectId]);

  const chartData = useMemo(() => {
    const days = last7Days();
    const byDate = runsByDay(recentRuns);
    return days.map(({ date, displayDate }) => ({
      date,
      displayDate,
      count: byDate.get(date) ?? 0,
    }));
  }, [recentRuns]);

  const activityFromRuns = useMemo(() => {
    return recentRuns
      .slice(0, 15)
      .map((r) => ({
        id: r.id,
        type: "run" as const,
        description: r.isCompleted ? `${r.name} (completed)` : `${r.name} (created)`,
        by: r.createdByName ?? "—",
        date: r.createdAt ?? "",
      }))
      .sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [recentRuns]);

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
  if (loading) return <LoadingSpinner />;
  if (error || !project) return <p className="text-error">{error || "Project not found"}</p>;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageTitle className="mb-0">{project.name}</PageTitle>
        <Link to={`/projects/${projectId}/settings`} className="text-sm text-primary hover:underline">
          Settings
        </Link>
      </div>

      {/* Tests in the past 7 days */}
      <Card className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <Activity size={20} className="shrink-0 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tests in the past 7 days</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">Test runs created by day.</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                labelFormatter={(_, payload) => payload[0]?.payload?.displayDate ?? ""}
                formatter={(value: number | undefined) => [`${value ?? 0} run${(value ?? 0) !== 1 ? "s" : ""}`, "Runs"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Runs">
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Milestones */}
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Flag size={18} className="shrink-0 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Milestones</h2>
          </div>
          {showNewMilestone && (
            <form onSubmit={createMilestone} className="mb-4 flex flex-wrap items-center gap-3 rounded border border-border bg-muted/50 p-4">
              <label className="flex items-center gap-2">
                Name <input value={newMilestoneName} onChange={(e) => setNewMilestoneName(e.target.value)} required className="rounded border border-input px-2 py-1 text-sm" />
              </label>
              <label className="flex items-center gap-2">
                Due date <input type="date" value={newMilestoneDue} onChange={(e) => setNewMilestoneDue(e.target.value)} className="rounded border border-input px-2 py-1 text-sm" />
              </label>
              <Button type="submit" variant="primary" disabled={saving}>Create</Button>
              <Button type="button" onClick={() => { setShowNewMilestone(false); setNewMilestoneName(""); setNewMilestoneDue(""); }}>Cancel</Button>
            </form>
          )}
          {!showNewMilestone && <Button type="button" variant="primary" onClick={() => setShowNewMilestone(true)} className="mb-3 text-sm">New milestone</Button>}
          <ul className="list-none p-0">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-1.5">
                <Flag size={14} className="shrink-0 text-violet-500" />
                <Link to={`/milestones/${m.id}/progress`} className="text-primary hover:underline">{m.name}</Link>
                <span className="text-xs text-muted-foreground">{m.dueDate ? `Due: ${new Date(m.dueDate).toLocaleDateString()}` : "No due date"}</span>
              </li>
            ))}
          </ul>
          {milestones.length === 0 && !showNewMilestone && <p className="text-sm text-muted-foreground">No milestones.</p>}
        </Card>

        {/* Test Runs */}
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderOpen size={18} className="shrink-0 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Test Runs</h2>
            </div>
            <div className="flex gap-2">
              <Link to="/runs/new">
                <Button variant="primary" className="text-sm">Add</Button>
              </Link>
              <Link to="/runs/overview">
                <Button variant="secondary" className="text-sm">View All</Button>
              </Link>
            </div>
          </div>
          <ul className="list-none p-0">
            {recentRuns.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-1.5">
                <FolderOpen size={14} className="shrink-0 text-muted-foreground" />
                <Link to={`/runs/${r.id}`} className="text-primary hover:underline">{r.name}</Link>
                <span className="text-xs text-muted-foreground">
                  By {r.createdByName ?? "—"} on {r.createdAt ? new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: "short" }) : "—"}
                </span>
              </li>
            ))}
          </ul>
          {recentRuns.length === 0 && <p className="text-sm text-muted-foreground">No test runs yet.</p>}
        </Card>
      </div>

      {/* Activity */}
      <Card className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <Activity size={18} className="shrink-0 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Activity</h2>
        </div>
        {auditLog.length > 0 ? (
          <ul className="list-none space-y-2 p-0">
            {auditLog.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted/50 px-2 py-1.5 text-sm">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{entry.entityType}</span>
                {entry.action} · {new Date(entry.createdAt).toLocaleString()} · {entry.userId.slice(0, 8)}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="list-none space-y-2 p-0">
            {activityFromRuns.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted/50 px-2 py-1.5 text-sm">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Test Run</span>
                {a.description} · {new Date(a.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {a.by}
              </li>
            ))}
          </ul>
        )}
        {auditLog.length === 0 && activityFromRuns.length === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
      </Card>

      {/* Suites and Test plans */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Layers size={18} className="shrink-0 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Suites</h2>
          </div>
          {showNewSuite && (
            <form onSubmit={createSuite} className="mb-4 flex flex-wrap items-center gap-3 rounded border border-border bg-muted/50 p-4">
              <label className="flex items-center gap-2">
                Name <input value={newSuiteName} onChange={(e) => setNewSuiteName(e.target.value)} required className="rounded border border-input px-2 py-1 text-sm" />
              </label>
              <Button type="submit" variant="primary" disabled={saving}>Create</Button>
              <Button type="button" onClick={() => { setShowNewSuite(false); setNewSuiteName(""); }}>Cancel</Button>
            </form>
          )}
          {!showNewSuite && <Button type="button" variant="primary" onClick={() => setShowNewSuite(true)} className="mb-3 text-sm">New suite</Button>}
          <ul className="list-none p-0">
            {suites.map((s) => (
              <li key={s.id} className="py-1.5">
                <Link to={`/suites/${s.id}`} className="text-primary hover:underline">{s.name}</Link>
              </li>
            ))}
          </ul>
          {suites.length === 0 && !showNewSuite && <p className="text-sm text-muted-foreground">No suites. Add one above.</p>}
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList size={18} className="shrink-0 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Test plans</h2>
          </div>
          {showNewPlan && (
            <form onSubmit={createPlan} className="mb-4 flex flex-wrap items-center gap-3 rounded border border-border bg-muted/50 p-4">
              <label className="flex items-center gap-2">
                Name <input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} required className="rounded border border-input px-2 py-1 text-sm" />
              </label>
              <label className="flex items-center gap-2">
                Milestone
                <Select value={newPlanMilestoneId} onValueChange={setNewPlanMilestoneId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="— None —" />
                  </SelectTrigger>
                  <SelectContent>
                    {milestones.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <Button type="submit" variant="primary" disabled={saving}>Create</Button>
              <Button type="button" onClick={() => { setShowNewPlan(false); setNewPlanName(""); setNewPlanMilestoneId(""); }}>Cancel</Button>
            </form>
          )}
          {!showNewPlan && <Button type="button" variant="primary" onClick={() => setShowNewPlan(true)} className="mb-3 text-sm">New plan</Button>}
          <ul className="list-none p-0">
            {plans.map((p) => (
              <li key={p.id} className="py-1.5">
                <Link to={`/plans/${p.id}/summary`} className="text-primary hover:underline">{p.name}</Link>
              </li>
            ))}
          </ul>
          {plans.length === 0 && !showNewPlan && <p className="text-sm text-muted-foreground">No test plans.</p>}
        </Card>
      </div>
    </div>
  );
}
