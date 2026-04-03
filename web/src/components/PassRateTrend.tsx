import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api, type PassRateTrend } from "../api";
import { Card } from "./ui/Card";
import { LoadingSpinner } from "./ui/LoadingSpinner";

export function PassRateTrendChart({ projectId }: { projectId: string }) {
  const [data, setData] = useState<PassRateTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<PassRateTrend[]>(`/api/projects/${projectId}/trends/pass-rate?days=30`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <LoadingSpinner />;
  if (data.length === 0) return null;

  return (
    <Card className="p-4">
      <h3 className="mb-1 font-mono text-sm font-semibold text-text">Pass Rate Trend</h3>
      <p className="mb-3 text-xs text-muted">Last 30 days</p>
      <div className="h-48" style={{ minWidth: 0, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#94A3B8" }}
              tickFormatter={(d: string) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              axisLine={{ stroke: "rgba(71,85,105,0.5)" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#94A3B8" }}
              tickFormatter={(v: number) => `${v}%`}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid rgba(71,85,105,0.5)", background: "#1E293B", color: "#F1F5F9", fontSize: 12 }}
              formatter={(value: number) => [`${value}%`, "Pass rate"]}
              labelFormatter={(d: string) => new Date(d + "T12:00:00").toLocaleDateString()}
            />
            <Line
              type="monotone"
              dataKey="passRate"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 3, fill: "#22c55e" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
