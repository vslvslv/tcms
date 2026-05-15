import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Milestone, type MilestoneScoreEntry } from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageTitle } from "../components/ui/PageTitle";
import { ReadinessScore } from "../components/ReadinessScore";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type Progress = {
  milestone: Milestone;
  runsCount: number;
  completedRuns: number;
  summary: { passed: number; failed: number; blocked: number; skipped: number; untested: number };
};

export default function MilestoneProgress() {
  const { milestoneId } = useParams<{ milestoneId: string }>();
  const [data, setData] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scores, setScores] = useState<MilestoneScoreEntry[]>([]);

  useEffect(() => {
    if (!milestoneId) return;
    api<Progress>(`/api/milestones/${milestoneId}/progress`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
    api<MilestoneScoreEntry[]>(`/api/milestones/${milestoneId}/scores`)
      .then(setScores)
      .catch(() => setScores([]));
  }, [milestoneId]);

  if (!milestoneId) return null;
  if (loading) return <LoadingSpinner />;
  if (error || !data) return <p className="text-error">{error || "Not found"}</p>;

  const { milestone, runsCount, completedRuns, summary } = data;
  const total = summary.passed + summary.failed + summary.blocked + summary.skipped + summary.untested;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Milestone: {milestone.name}</PageTitle>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              const res = await api<{ shareUrl: string }>(`/api/milestones/${milestoneId}/share`, { method: "POST", body: JSON.stringify({}) });
              window.prompt("Share link (copy):", res.shareUrl);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Share failed");
            }
          }}
        >
          Share
        </Button>
      </div>
      {milestone.description && <p className="mb-2 text-muted">{milestone.description}</p>}
      {milestone.dueDate && <p className="mb-6 text-sm text-muted">Due: {new Date(milestone.dueDate).toLocaleDateString()}</p>}
      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Progress</h3>
        <p className="mb-2">Runs: {completedRuns} / {runsCount} completed</p>
        {total > 0 && (
          <ul className="list-none p-0 text-sm">
            <li className="text-success">Passed: {summary.passed}</li>
            <li className="text-error">Failed: {summary.failed}</li>
            <li className="text-warning">Blocked: {summary.blocked}</li>
            <li className="text-muted">Skipped: {summary.skipped}</li>
            <li className="text-muted">Untested: {summary.untested}</li>
          </ul>
        )}
      </Card>

      {milestoneId && <ReadinessScore milestoneId={milestoneId} />}

      {/* Score history chart */}
      <Card className="mt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Score History</h3>
        {scores.length < 2 ? (
          <p className="text-sm text-muted py-4 text-center">
            {scores.length === 0
              ? "Run some tests to see score history."
              : "Need at least 2 data points to show a trend."}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={scores.map((s) => ({
                date: new Date(s.recordedAt).toLocaleDateString(),
                passRate: s.passRate,
              }))}
              margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            >
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-border)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--color-border)" unit="%" />
              <Tooltip
                contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number) => [`${value}%`, "Pass rate"]) as any}
              />
              <Line type="monotone" dataKey="passRate" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
