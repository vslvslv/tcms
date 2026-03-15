import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProject } from "../../ProjectContext";
import { api, type ProjectRun, type Project } from "../../api";
import { useDialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { PageTitle } from "../../components/ui/PageTitle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/Select";
import { cn } from "../../lib/cn";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
}

function formatSectionDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function progressPct(summary: { passed: number; failed: number; blocked: number; skipped: number; untested: number }): number {
  const total = summary.passed + summary.failed + summary.blocked + summary.skipped + summary.untested;
  if (total === 0) return 0;
  const completed = summary.passed + summary.failed + summary.blocked + summary.skipped;
  return Math.round((completed / total) * 100);
}

export default function RunsOverview() {
  const dialog = useDialog();
  const { projectId } = useProject();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<ProjectRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<string>("none");
  const [orderBy, setOrderBy] = useState<string>("date");

  useEffect(() => {
    api<Project[]>("/api/projects")
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setRuns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    api<ProjectRun[]>(`/api/projects/${projectId}/runs?limit=250`)
      .then(setRuns)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load runs");
        setRuns([]);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleDelete(runId: string) {
    const ok = await dialog.confirm({
      title: "Delete test run",
      message: "Delete this test run? This cannot be undone.",
      icon: "delete",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(runId);
    try {
      await api(`/api/runs/${runId}`, { method: "DELETE" });
      setRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  const sortRuns = (list: ProjectRun[]) => {
    if (orderBy === "name") return [...list].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return [...list].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  };

  const openRuns = sortRuns(runs.filter((r) => !r.isCompleted));
  const completedRuns = sortRuns(runs.filter((r) => r.isCompleted));

  const completedGrouped =
    groupBy === "milestone"
      ? (() => {
          const byMilestone = new Map<string, ProjectRun[]>();
          for (const r of completedRuns) {
            const key = r.milestoneId && r.milestoneName ? r.milestoneId : "__none__";
            if (!byMilestone.has(key)) byMilestone.set(key, []);
            byMilestone.get(key)!.push(r);
          }
          return { type: "milestone" as const, groups: byMilestone, keys: [...byMilestone.keys()] };
        })()
      : (() => {
          const byDate = new Map<string, ProjectRun[]>();
          for (const r of completedRuns) {
            const key = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
            if (!byDate.has(key)) byDate.set(key, []);
            byDate.get(key)!.push(r);
          }
          return { type: "date" as const, groups: byDate, keys: [...byDate.keys()].sort((a, b) => b.localeCompare(a)) };
        })();

  if (!projectId) {
    return (
      <div data-testid="runs-empty-state">
        <PageTitle className="mb-4">Test Runs &amp; Results</PageTitle>
        <EmptyState
          message="Select a project from the sidebar to view test runs."
          action={
            <Button variant="primary" onClick={() => navigate("/projects")}>
              View projects
            </Button>
          }
        />
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-error">{error}</p>;

  const projectName = projects.find((p) => p.id === projectId)?.name ?? "Project";

  return (
    <div>
      <PageTitle className="mb-4">Test Runs &amp; Results</PageTitle>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/runs/new">
          <Button variant="primary">+ Add Test Run</Button>
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Group by
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="milestone">Milestone</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Order by
            <Select value={orderBy} onValueChange={setOrderBy}>
              <SelectTrigger className="w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
      </div>

      {openRuns.length === 0 && completedRuns.length === 0 && (
        <div data-testid="runs-empty-state">
          <EmptyState
            message={`No test runs yet in ${projectName}. Create a run from a suite.`}
            action={
              <Link to="/runs/new">
                <Button variant="primary">+ Add Test Run</Button>
              </Link>
            }
          />
        </div>
      )}

      {openRuns.length > 0 && (
        <section className="mb-8" data-testid="runs-open-list">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Open</h2>
          <ul className="list-none space-y-2 p-0">
            {openRuns.map((r) => (
              <RunCard key={r.id} run={r} onDelete={() => handleDelete(r.id)} deleting={deletingId === r.id} />
            ))}
          </ul>
        </section>
      )}

      {completedRuns.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Completed</h2>
          {completedGrouped.keys.map((key) => {
            const list = completedGrouped.groups.get(key)!;
            const label =
              completedGrouped.type === "milestone"
                ? key === "__none__"
                  ? "No milestone"
                  : list[0]?.milestoneName ?? key
                : list[0]?.createdAt
                  ? formatSectionDate(list[0].createdAt)
                  : key;
            return (
              <div key={key} className="mb-6">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">{label}</h3>
                <ul className="list-none space-y-2 p-0">
                  {list.map((r) => (
                    <RunCard key={r.id} run={r} onDelete={() => handleDelete(r.id)} deleting={deletingId === r.id} compact />
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function RunCard({
  run,
  onDelete,
  deleting,
  compact = false,
}: {
  run: ProjectRun;
  onDelete: () => void;
  deleting: boolean;
  compact?: boolean;
}) {
  const summary = run.summary ?? { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: 0 };
  const total = summary.passed + summary.failed + summary.blocked + summary.skipped + summary.untested;
  const pct = progressPct(summary);

  return (
    <Card className={cn("flex items-start gap-3", compact && "py-2")}>
      <div className="flex shrink-0 items-center justify-center rounded bg-primary/10 p-1.5 text-primary">
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link to={`/runs/${run.id}`} className="font-medium text-primary hover:underline">
            {run.name}
          </Link>
          {compact && (
            <span className="text-sm text-muted-foreground">{pct}%</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          By {run.createdByName ?? "Unknown"} on {run.createdAt ? formatDate(run.createdAt) : "—"}
          {" · "}
          <Link to={`/runs/${run.id}`} className="text-primary hover:underline">Edit</Link>
        </p>
        {!compact && (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.passed} Passed, {summary.blocked} Blocked, {summary.untested} Untested, {summary.skipped} Skipped, {summary.failed} Failed
            </p>
            {total > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="flex h-full">
                    {summary.passed > 0 && (
                      <div className="bg-success" style={{ width: `${(summary.passed / total) * 100}%` }} />
                    )}
                    {summary.failed > 0 && (
                      <div className="bg-error" style={{ width: `${(summary.failed / total) * 100}%` }} />
                    )}
                    {summary.blocked > 0 && (
                      <div className="bg-warning" style={{ width: `${(summary.blocked / total) * 100}%` }} />
                    )}
                    {summary.skipped > 0 && (
                      <div className="bg-muted-foreground/70" style={{ width: `${(summary.skipped / total) * 100}%` }} />
                    )}
                    {summary.untested > 0 && (
                      <div className="bg-muted" style={{ width: `${(summary.untested / total) * 100}%` }} />
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
              </div>
            )}
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-error/10 hover:text-error"
        aria-label="Remove run"
      >
        <span className="text-lg leading-none">×</span>
      </button>
    </Card>
  );
}
