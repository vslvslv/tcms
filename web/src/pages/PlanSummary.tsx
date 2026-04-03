import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type TestPlan, type Run } from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageTitle } from "../components/ui/PageTitle";

type RunSummary = { run: Run; summary: { passed: number; failed: number; blocked: number; skipped: number; untested: number } };
type PlanSummaryData = { plan: TestPlan; runs: RunSummary[] };

export default function PlanSummary() {
  const { planId } = useParams<{ planId: string }>();
  const [data, setData] = useState<PlanSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!planId) return;
    api<PlanSummaryData>(`/api/plans/${planId}/summary`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [planId]);

  if (!planId) return null;
  if (loading) return <LoadingSpinner />;
  if (error || !data) return <p className="text-error">{error || "Not found"}</p>;

  const { plan, runs } = data;

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <PageTitle>{plan.name}</PageTitle>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              const res = await api<{ shareUrl: string }>(`/api/plans/${planId}/share`, { method: "POST", body: JSON.stringify({}) });
              window.prompt("Share link (copy):", res.shareUrl);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Share failed");
            }
          }}
        >
          Share
        </Button>
      </div>
      {plan.description && <p className="mb-6 text-muted">{plan.description}</p>}
      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Runs ({runs.length})</h3>
        <ul className="list-none p-0">
          {runs.map(({ run, summary }) => {
            const total = summary.passed + summary.failed + summary.blocked + summary.skipped + summary.untested;
            return (
              <li key={run.id} className="border-b border-border py-3 last:border-0">
                <Link to={`/runs/${run.id}`} className="font-medium text-primary hover:underline">{run.name}</Link>
                {run.isCompleted && <span className="ml-2 text-sm text-success">Completed</span>}
                {total > 0 && (
                  <span className="ml-2 text-sm text-muted">
                    P: {summary.passed} F: {summary.failed} B: {summary.blocked} S: {summary.skipped} U: {summary.untested}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {runs.length === 0 && <p className="text-muted">No runs in this plan yet.</p>}
      </Card>
    </div>
  );
}
