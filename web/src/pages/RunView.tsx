import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Run, type IssueLink } from "../api";

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
  const [resultIssueLinks, setResultIssueLinks] = useState<IssueLink[]>([]);
  const [newIssueUrl, setNewIssueUrl] = useState("");
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

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

  const selectedResultId = run?.tests?.find((t) => t.id === selectedTestId)?.latestResult?.id;
  useEffect(() => {
    if (!selectedResultId) {
      setResultIssueLinks([]);
      return;
    }
    api<IssueLink[]>(`/api/results/${selectedResultId}/issue-links`)
      .then(setResultIssueLinks)
      .catch(() => setResultIssueLinks([]));
  }, [selectedResultId]);

  async function addResultIssueLink(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedResultId || !newIssueUrl.trim()) return;
    try {
      await api(`/api/results/${selectedResultId}/issue-links`, {
        method: "POST",
        body: JSON.stringify({ url: newIssueUrl.trim(), title: newIssueTitle.trim() || undefined }),
      });
      setNewIssueUrl("");
      setNewIssueTitle("");
      const list = await api<IssueLink[]>(`/api/results/${selectedResultId}/issue-links`);
      setResultIssueLinks(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add link");
    }
  }

  async function removeResultIssueLink(linkId: string) {
    try {
      await api(`/api/issue-links/${linkId}`, { method: "DELETE" });
      if (selectedResultId) {
        const list = await api<IssueLink[]>(`/api/results/${selectedResultId}/issue-links`);
        setResultIssueLinks(list);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove link");
    }
  }

  async function importResults(file: File) {
    if (!runId) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const text = await file.text();
      const isXml = file.name.toLowerCase().endsWith(".xml") || file.type === "application/xml";
      const contentType = isXml ? "application/xml" : "application/json";
      const res = await api<{ imported: number; added: number; updated: number }>(`/api/runs/${runId}/import/results`, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: text,
      });
      setImportMessage(`Imported: ${res.imported} (${res.added} new tests, ${res.updated} results to existing)`);
      loadRun();
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

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
      setResultIssueLinks([]);
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
      <div style={{ marginBottom: 16 }}>
        <label>
          Import results (JUnit XML or Playwright JSON):{" "}
          <input
            type="file"
            accept=".xml,.json,application/xml,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importResults(f);
              e.target.value = "";
            }}
            disabled={importing}
          />
        </label>
        {importMessage && <span style={{ marginLeft: 8, color: importMessage.startsWith("Imported") ? "green" : "red" }}>{importMessage}</span>}
      </div>
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
                  {t.caseTitle}
                  {t.datasetRow && Object.keys(t.datasetRow).length > 0 && (
                    <span style={{ color: "#666" }}> — {Object.entries(t.datasetRow).map(([k, v]) => `${k}: ${v}`).join(", ")}</span>
                  )}
                  {" "}— {t.latestResult?.status ?? "untested"}
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
              {selectedResultId && (
                <>
                  <h4 style={{ marginTop: 16 }}>Defects / Issues</h4>
                  <ul style={{ listStyle: "none", padding: 0 }}>
                    {resultIssueLinks.map((l) => (
                      <li key={l.id} style={{ marginBottom: 4 }}>
                        <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title || l.url}</a>
                        <button type="button" style={{ marginLeft: 8 }} onClick={() => removeResultIssueLink(l.id)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                  <form onSubmit={addResultIssueLink} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    <input value={newIssueUrl} onChange={(e) => setNewIssueUrl(e.target.value)} placeholder="URL" style={{ minWidth: 180 }} required />
                    <input value={newIssueTitle} onChange={(e) => setNewIssueTitle(e.target.value)} placeholder="Title (optional)" />
                    <button type="submit">Add link</button>
                  </form>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
