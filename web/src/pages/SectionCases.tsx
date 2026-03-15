import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, getToken, type TestCase, type CaseTemplate, type Section, type Suite } from "../api";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/Select";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageTitle } from "../components/ui/PageTitle";

export default function SectionCases() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const navigate = useNavigate();
  const [cases, setCases] = useState<(TestCase & { steps?: unknown[]; status?: string })[]>([]);
  const [templates, setTemplates] = useState<CaseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [templateSelectValue, setTemplateSelectValue] = useState("");

  useEffect(() => {
    if (!sectionId) return;
    const url = statusFilter ? `/api/sections/${sectionId}/cases?status=${encodeURIComponent(statusFilter)}` : `/api/sections/${sectionId}/cases`;
    api<(TestCase & { steps?: unknown[]; status?: string })[]>(url)
      .then(setCases)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
    api<Section>(`/api/sections/${sectionId}`)
      .then((sec) => api<Suite>(`/api/suites/${sec.suiteId}`))
      .then((suite) => api<CaseTemplate[]>(`/api/projects/${suite.projectId}/case-templates`))
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [sectionId, statusFilter]);

  if (!sectionId) return null;
  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-error">{error}</p>;

  return (
    <div className="max-w-4xl">
      <PageTitle className="mb-4">Test cases</PageTitle>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => navigate(`/sections/${sectionId}/cases/new`)}>Add case</Button>
        <Button
          variant="secondary"
          onClick={async () => {
            setError("");
            try {
              const token = getToken();
              const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api/sections/${sectionId}/cases/export`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (!res.ok) throw new Error(await res.text());
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "cases.csv";
              a.click();
              URL.revokeObjectURL(url);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Export failed");
            }
          }}
        >
          Export CSV
        </Button>
        <span className="text-sm text-muted-foreground">Import CSV:</span>
        <input
          type="file"
          accept=".csv"
          className="text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file || !sectionId) return;
            setImportResult(null);
            setError("");
            try {
              const text = await file.text();
              const token = getToken();
              const res = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api/sections/${sectionId}/cases/import`, {
                method: "POST",
                headers: { "Content-Type": "text/csv", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: text,
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setError((data as { error?: string }).error ?? res.statusText);
                return;
              }
              setImportResult(data as { created: number; errors: { row: number; message: string }[] });
              if ((data as { created?: number }).created) {
                const list = await api<(TestCase & { steps?: unknown[]; status?: string })[]>(`/api/sections/${sectionId}/cases`);
                setCases(list);
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : "Import failed");
            }
          }}
        />
        {templates.length > 0 && (
          <>
            <span className="text-sm text-muted-foreground">New from template:</span>
            <Select
              value={templateSelectValue}
              onValueChange={(id) => {
                if (id) {
                  navigate(`/sections/${sectionId}/cases/new?templateId=${id}`);
                  setTemplateSelectValue("");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Choose —" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      <div className="mb-2">
        <label className="text-sm text-muted-foreground">
          Filter by status:{" "}
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[400px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-semibold text-foreground">Title</th>
              <th className="px-3 py-2 text-left font-semibold text-foreground">Status</th>
              <th className="w-20 px-3 py-2 text-right font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link to={`/cases/${c.id}/edit`} className="text-primary hover:underline">{c.title || "(Untitled)"}</Link>
                </td>
                <td className="px-3 py-2">
                  {c.status ? (
                    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${c.status === "approved" ? "bg-success/15 text-success" : c.status === "ready" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {c.status}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link to={`/cases/${c.id}/edit`} className="text-primary text-xs hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {importResult && (
        <p className="mt-4 text-sm">
          Import: {importResult.created} created.
          {importResult.errors.length > 0 && ` ${importResult.errors.length} error(s): ${importResult.errors.map((e) => `Row ${e.row}: ${e.message}`).join("; ")}`}
        </p>
      )}
      {cases.length === 0 && !importResult && (
        <EmptyState
          message="No cases yet."
          action={<Button variant="primary" onClick={() => navigate(`/sections/${sectionId}/cases/new`)}>Add case</Button>}
        />
      )}
    </div>
  );
}
