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
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Pass Rate Trend</h3>
      <p className="mb-3 text-xs text-muted">Last 30 days</p>
      <div className="h-48" style={{ minWidth: 0, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(d: string) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(v: number) => `${v}%`}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
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
