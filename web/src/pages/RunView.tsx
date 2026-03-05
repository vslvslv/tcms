import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Run } from "../api";

const STATUSES = ["passed", "failed", "blocked", "skipped", "untested"] as const;

export default function RunView() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<string>("passed");
  const [resultComment, setResultComment] = useState("");
  const [resultElapsed, setResultElapsed] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadRun() {
    if (!runId) return;
    api<Run>(`/api/runs/${runId}`)
      .then(setRun)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRun();
  }, [runId]);

  async function submitResult(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTestId) return;
    setSubmitting(true);
    try {
      await api(`/api/tests/${selectedTestId}/results`, {
        method: "POST",
        body: JSON.stringify({
          status: resultStatus,
          comment: resultComment || undefined,
          elapsedSeconds: resultElapsed ? parseInt(resultElapsed, 10) : undefined,
        }),
      });
      setSelectedTestId(null);
      setResultComment("");
      setResultElapsed("");
      loadRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save result");
    } finally {
      setSubmitting(false);
    }
  }

  if (!runId) return null;
  if (loading) return <p>Loading…</p>;
  if (error && !run) return <p style={{ color: "red" }}>{error}</p>;
  if (!run) return null;

  const summary = run.summary ?? { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: 0 };
  const tests = run.tests ?? [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 24 }}>
        <Link to="/projects">Projects</Link> → <strong>{run.name}</strong>
      </header>
      <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
        <span>Passed: {summary.passed}</span>
        <span>Failed: {summary.failed}</span>
        <span>Blocked: {summary.blocked}</span>
        <span>Skipped: {summary.skipped}</span>
        <span>Untested: {summary.untested}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24 }}>
        <div>
          <h2>Tests</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {tests.map((t) => (
              <li key={t.id} style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTestId(t.id);
                    setResultStatus(t.latestResult?.status ?? "untested");
                    setResultComment(t.latestResult?.comment ?? "");
                    setResultElapsed(t.latestResult?.elapsedSeconds != null ? String(t.latestResult.elapsedSeconds) : "");
                  }}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    padding: 8,
                    background: selectedTestId === t.id ? "#e0e0e0" : "transparent",
                  }}
                >
                  {t.caseTitle} — {t.latestResult?.status ?? "untested"}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {selectedTestId && (
            <form onSubmit={submitResult} style={{ border: "1px solid #ccc", padding: 16 }}>
              <h3>Record result</h3>
              <div style={{ marginBottom: 8 }}>
                <label>
                  Status{" "}
                  <select value={resultStatus} onChange={(e) => setResultStatus(e.target.value)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label>
                  Comment <textarea value={resultComment} onChange={(e) => setResultComment(e.target.value)} rows={2} style={{ width: "100%" }} />
                </label>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label>
                  Elapsed (seconds) <input type="number" min={0} value={resultElapsed} onChange={(e) => setResultElapsed(e.target.value)} />
                </label>
              </div>
              <button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save result"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
