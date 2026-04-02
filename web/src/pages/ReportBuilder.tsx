import { useState } from "react";
import { api, type ReportResult } from "../api";
import { useProject } from "../ProjectContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { PageTitle } from "../components/ui/PageTitle";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

export default function ReportBuilder() {
  const { projectId } = useProject();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [results, setResults] = useState<ReportResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function runReport() {
    if (!projectId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (statusFilter) params.set("status", statusFilter);
      const data = await api<ReportResult[]>(`/api/projects/${projectId}/reports?${params}`);
      setResults(data);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const header = "Case Title,Run Name,Status,Comment,Elapsed (s),Date";
    const rows = results.map((r) =>
      [r.caseTitle, r.runName, r.status, r.comment ?? "", r.elapsedSeconds ?? "", new Date(r.createdAt).toISOString()].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!projectId) {
    return (
      <div className="max-w-5xl">
        <PageTitle className="mb-6">Report Builder</PageTitle>
        <p className="text-muted">Select a project to build reports.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <PageTitle className="mb-6">Report Builder</PageTitle>

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">All</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="blocked">Blocked</option>
              <option value="skipped">Skipped</option>
            </Select>
          </div>
          <Button variant="primary" onClick={runReport} disabled={loading}>
            {loading ? "Loading..." : "Run Report"}
          </Button>
          {results.length > 0 && (
            <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          )}
        </div>
      </Card>

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      {loading && <LoadingSpinner />}

      {searched && !loading && results.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-muted">No results match your filters.</p>
          <p className="mt-1 text-xs text-muted">Try adjusting the date range or status filter.</p>
        </Card>
      )}

      {results.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Case</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Run</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Comment</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Time</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium">{r.caseTitle}</td>
                    <td className="px-3 py-2 text-muted">{r.runName}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        r.status === "passed" ? "bg-green-100 text-green-800" :
                        r.status === "failed" ? "bg-red-100 text-red-800" :
                        r.status === "blocked" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-700"
                      }`}>{r.status}</span>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-muted">{r.comment ?? ""}</td>
                    <td className="px-3 py-2 tabular-nums text-muted">{r.elapsedSeconds ? `${r.elapsedSeconds}s` : ""}</td>
                    <td className="px-3 py-2 text-xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted">
            {results.length} result{results.length !== 1 ? "s" : ""}{results.length === 500 ? " (max 500 shown)" : ""}
          </div>
        </Card>
      )}
    </div>
  );
}
