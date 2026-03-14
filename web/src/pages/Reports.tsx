import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Bar, Pie } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { getChartThemeOptions } from "../charts/register";
import { api } from "../api";
import { Card } from "../components/ui/Card";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageTitle } from "../components/ui/PageTitle";

type DashboardData = {
  projects: { id: string; name: string }[];
  milestones: { id: string; projectId: string; name: string; dueDate: string | null }[];
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

const PIE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#6b7280", "#dc2626"];

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

  const activityData = useMemo(() => (data?.recentRuns ? groupRunsByDate(data.recentRuns) : []), [data?.recentRuns]);

  const overviewPieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Projects", value: data.projects.length, color: PIE_COLORS[0] },
      { name: "Milestones", value: data.milestones.length, color: PIE_COLORS[1] },
      { name: "Recent runs (sample)", value: Math.min(data.recentRuns.length, 20), color: PIE_COLORS[2] },
    ].filter((d) => d.value > 0);
  }, [data]);

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-error">{error}</p>;

  return (
    <div className="max-w-4xl">
      <PageTitle className="mb-6">Reports</PageTitle>
      <p className="mb-6 text-muted-foreground">Overview of your projects and recent activity.</p>

      {overviewPieData.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Overview</h2>
          <div className="h-64">
            <Pie
              data={{
                labels: overviewPieData.map((d) => d.name),
                datasets: [
                  {
                    data: overviewPieData.map((d) => d.value),
                    backgroundColor: overviewPieData.map((d) => d.color),
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "bottom",
                    ...getChartThemeOptions().plugins?.legend,
                  },
                  tooltip: {
                    ...getChartThemeOptions().plugins?.tooltip,
                    callbacks: {
                      label: (ctx) => `${ctx.label}: ${ctx.raw}`,
                    },
                  },
                },
              } as ChartOptions<"pie">}
            />
          </div>
        </Card>
      )}

      {activityData.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Runs by day (last 14 days)</h2>
          <div className="h-64">
            <Bar
              data={{
                labels: activityData.map((d) => d.date),
                datasets: [
                  {
                    label: "Runs",
                    data: activityData.map((d) => d.count),
                    backgroundColor: "#2563eb",
                    borderRadius: { topLeft: 2, topRight: 2 },
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    ...getChartThemeOptions().plugins?.tooltip,
                    callbacks: {
                      label: (ctx) => `${ctx.raw} run${Number(ctx.raw) !== 1 ? "s" : ""}`,
                    },
                  },
                },
                scales: {
                  x: {
                    ...getChartThemeOptions().scales?.x,
                    ticks: { font: { size: 11 }, ...getChartThemeOptions().scales?.x?.ticks },
                    grid: { display: false },
                  },
                  y: {
                    ...getChartThemeOptions().scales?.y,
                    beginAtZero: true,
                    ticks: { font: { size: 11 }, stepSize: 1, ...getChartThemeOptions().scales?.y?.ticks },
                    grid: { ...getChartThemeOptions().scales?.y?.grid },
                    border: { display: false },
                  },
                },
              } as ChartOptions<"bar">}
            />
          </div>
        </Card>
      )}

      {!data?.projects.length && !loading && (
        <Card>
          <p className="text-muted-foreground">No data yet. <Link to="/projects" className="text-primary hover:underline">Create a project</Link> to see reports.</p>
        </Card>
      )}
    </div>
  );
}
