import { useEffect, useState } from "react";
import { api, type MilestoneReadiness } from "../api";
import { Card } from "./ui/Card";

function MetricBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  if (value === null) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs text-muted">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-surface-raised overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-medium tabular-nums">{value}%</span>
    </div>
  );
}

export function ReadinessScore({ milestoneId }: { milestoneId: string }) {
  const [data, setData] = useState<MilestoneReadiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<MilestoneReadiness>(`/api/milestones/${milestoneId}/readiness`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [milestoneId]);

  if (loading || !data) return null;
  if (data.passRate === null) {
    return (
      <Card className="p-4">
        <h3 className="mb-1 font-mono text-sm font-semibold text-text">Release Readiness</h3>
        <p className="text-sm text-muted">No test results yet for this milestone.</p>
      </Card>
    );
  }

  const passColor = data.passRate >= 80 ? "bg-success" : data.passRate >= 60 ? "bg-warning" : "bg-error";
  const blockerColor = (data.blockerRate ?? 0) === 0 ? "bg-success" : (data.blockerRate ?? 0) <= 5 ? "bg-warning" : "bg-error";

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-sm font-semibold text-text">Release Readiness</h3>
        <span className="text-xs text-muted">{data.runsAnalyzed} runs, {data.totalResults} tests</span>
      </div>
      <div className="space-y-2">
        <MetricBar label="Pass rate" value={data.passRate} color={passColor} />
        <MetricBar label="Blocked" value={data.blockerRate} color={blockerColor} />
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span>{data.passed} passed</span>
        <span>{data.failed} failed</span>
        <span>{data.blocked} blocked</span>
      </div>
    </Card>
  );
}
