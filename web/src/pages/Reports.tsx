import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
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

function groupRunsByDate(runs: { createdAt: string }[]): { date: string; count: number }[] {
  const byDate = new Map<string, number>();
  for (const r of runs) {
    const d = r.createdAt.slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + 1);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, count]) => ({ date, count }));
}

const PIE_COLORS = ["#22C55E", "#34D399", "#F59E0B", "#94A3B8", "#EF4444"];

export default function Reports() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const activityData = useMemo(() => (data?.recentRuns ? groupRunsByDate(data.recentRuns) : []), // eslint-disable-line react-hooks/preserve-manual-memoization
    [data?.recentRuns]);

  const overviewPieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Projects", value: data.projects.length, color: PIE_COLORS[0] },
      { name: "Milestones", value: data.milestones.length, color: PIE_COLORS[1] },
      { name: "Test plans", value: data.plans.length, color: PIE_COLORS[2] },
      { name: "Recent runs (sample)", value: Math.min(data.recentRuns.length, 20), color: PIE_COLORS[3] },
    ].filter((d) => d.value > 0);
  }, [data]);

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-error">{error}</p>;

  return (
    <div className="max-w-4xl">
      <PageTitle className="mb-6">Reports</PageTitle>
      <p className="mb-6 text-muted">Overview of your projects and recent activity.</p>

      {overviewPieData.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Overview</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={overviewPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${e.value}`}>
                  {overviewPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1E293B", color: "#F1F5F9", border: "1px solid rgba(71,85,105,0.5)" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {activityData.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Runs by day (last 14 days)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                <Tooltip contentStyle={{ background: "#1E293B", color: "#F1F5F9", border: "1px solid rgba(71,85,105,0.5)" }} />
                <Bar dataKey="count" fill="#22C55E" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {!data?.projects.length && !loading && (
        <Card>
          <p className="text-muted">No data yet. <Link to="/projects" className="text-primary hover:underline">Create a project</Link> to see reports.</p>
        </Card>
      )}
    </div>
  );
}
