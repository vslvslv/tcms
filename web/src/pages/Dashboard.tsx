import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../api";
import { Card } from "../components/ui/Card";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageTitle } from "../components/ui/PageTitle";

type DashboardData = {
  projects: { id: string; name: string }[];
  milestones: { id: string; projectId: string; name: string; dueDate: string | null }[];
  plans: { id: string; projectId: string; name: string; milestoneId: string | null }[];
  recentRuns: { id: string; name: string; suiteId: string; projectId?: string; createdAt: string }[];
};

function groupRunsByDate(runs: { createdAt: string }[]): { date: string; count: number; displayDate: string }[] {
  const byDate = new Map<string, number>();
  for (const r of runs) {
    const d = r.createdAt.slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + 1);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, count]) => ({
      date,
      count,
      displayDate: new Date(date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }),
    }));
}

const CHART_COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"];

function StatCard({
  label,
  value,
  href,
}: { label: string; value: number; href?: string }) {
  const content = (
    <>
      <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </>
  );
  return (
    <Card className="flex flex-col gap-1 p-4 transition-shadow hover:shadow-md">
      {href ? (
        <Link to={href} className="flex flex-col gap-1 no-underline hover:underline-offset-2 [&>span:first-child]:hover:text-primary">
          {content}
        </Link>
      ) : (
        content
      )}
    </Card>
  );
}

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

  const activityData = useMemo(
    () => (data?.recentRuns ? groupRunsByDate(data.recentRuns) : []),
    [data?.recentRuns]
  );

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <div className="max-w-5xl">
        <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {error}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const hasAny = data.projects.length > 0 || data.milestones.length > 0 || data.plans.length > 0 || data.recentRuns.length > 0;

  return (
    <div className="max-w-5xl">
      <PageTitle className="mb-6">Dashboard</PageTitle>
      <p className="mb-8 text-muted-foreground">
        Overview of your projects, milestones, test plans, and recent activity.
      </p>

      {/* Stats strip – TestRail-style summary */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Projects" value={data.projects.length} href={data.projects.length > 0 ? "/projects" : undefined} />
        <StatCard label="Milestones" value={data.milestones.length} />
        <StatCard label="Test plans" value={data.plans.length} />
        <StatCard label="Recent runs" value={data.recentRuns.length} />
      </div>

      {/* Activity chart – TestRail shows activity by date */}
      {activityData.length > 0 && (
        <Card className="mb-8">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Activity</h2>
            <span className="text-xs text-muted-foreground">Test runs created by day</span>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Dates and quantity of test runs. Automatically updates as new runs are added.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
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
                  {activityData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Content grid – Projects, Milestones, Plans, Recent runs */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Projects</h2>
          {data.projects.length > 0 ? (
            <ul className="list-none space-y-2 p-0">
              {data.projects.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <Link to={`/projects/${p.id}`} className="font-medium text-primary hover:underline">
                    {p.name}
                  </Link>
                  <Link to={`/projects/${p.id}/settings`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                    Settings
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No projects.</p>
          )}
          {data.projects.length > 8 && (
            <p className="mt-3 border-t border-border pt-3">
              <Link to="/projects" className="text-sm text-primary hover:underline">
                View all projects →
              </Link>
            </p>
          )}
          {data.projects.length > 0 && data.projects.length <= 8 && (
            <p className="mt-3 border-t border-border pt-3">
              <Link to="/projects" className="text-sm text-primary hover:underline">
                Go to projects →
              </Link>
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Milestones</h2>
          {data.milestones.length > 0 ? (
            <ul className="list-none space-y-2 p-0">
              {data.milestones.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <Link to={`/milestones/${m.id}/progress`} className="font-medium text-primary hover:underline">
                    {m.name}
                  </Link>
                  {m.dueDate && (
                    <span className="text-xs text-muted-foreground">Due {new Date(m.dueDate).toLocaleDateString(undefined, { dateStyle: "short" })}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No milestones.</p>
          )}
          {data.milestones.length > 6 && (
            <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
              +{data.milestones.length - 6} more
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Test plans</h2>
          {data.plans.length > 0 ? (
            <ul className="list-none space-y-2 p-0">
              {data.plans.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link to={`/plans/${p.id}/summary`} className="font-medium text-primary hover:underline">
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No test plans.</p>
          )}
          {data.plans.length > 6 && (
            <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
              +{data.plans.length - 6} more
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent test runs</h2>
          {data.recentRuns.length > 0 ? (
            <ul className="list-none space-y-2 p-0">
              {data.recentRuns.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <Link to={`/runs/${r.id}`} className="font-medium text-primary hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No runs yet.</p>
          )}
          {data.recentRuns.length > 6 && (
            <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
              +{data.recentRuns.length - 6} more
            </p>
          )}
        </Card>
      </div>

      {!hasAny && (
        <Card className="mt-6 border-dashed">
          <p className="text-center text-muted-foreground">
            Get started by <Link to="/projects" className="text-primary hover:underline">creating a project</Link>.
          </p>
        </Card>
      )}
    </div>
  );
}
