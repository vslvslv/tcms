import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, getToken, type TestCase, type CaseTemplate, type Section, type Suite, type BulkCasesBody, type BulkCasesResult } from "../api";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Select } from "../components/ui/Select";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageTitle } from "../components/ui/PageTitle";
import { StatusBadge } from "../components/ui/StatusBadge";

export default function SectionCases() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const navigate = useNavigate();
  const [cases, setCases] = useState<(TestCase & { steps?: unknown[]; status?: string })[]>([]);
  const [templates, setTemplates] = useState<CaseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  // Bulk selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"delete" | "move" | "copy">("delete");
  const [targetSectionId, setTargetSectionId] = useState("");
  const [siblingsSections, setSiblingsSections] = useState<Section[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState("");

  useEffect(() => {
    if (!sectionId) return;
    const url = statusFilter ? `/api/sections/${sectionId}/cases?status=${encodeURIComponent(statusFilter)}` : `/api/sections/${sectionId}/cases`;
    api<(TestCase & { steps?: unknown[]; status?: string })[]>(url)
      .then(setCases)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
    api<Section>(`/api/sections/${sectionId}`)
      .then((sec) => api<Suite>(`/api/suites/${sec.suiteId}`).then((suite) => ({ sec, suite })))
      .then(({ sec, suite }) => {
        setProjectId(suite.projectId);
        // Load sibling sections for the same suite (for move/copy target)
        return api<Section[]>(`/api/suites/${sec.suiteId}/sections`).then((secs) => {
          setSiblingsSections(secs.filter((s) => s.id !== sectionId));
          return suite.projectId;
        });
      })
      .then((pid) => api<CaseTemplate[]>(`/api/projects/${pid}/case-templates`))
      .then(setTemplates)
      .catch(() => {
        setTemplates([]);
        setSiblingsSections([]);
      });
  }, [sectionId, statusFilter]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === cases.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cases.map((c) => c.id)));
    }
  }

  async function handleBulkSubmit() {
    if (!projectId || selected.size === 0) return;
    if ((bulkAction === "move" || bulkAction === "copy") && !targetSectionId) {
      setError("Select a target section for move/copy");
      return;
    }
    setBulkWorking(true);
    setError("");
    setBulkSuccess("");
    try {
      const body: BulkCasesBody = {
        action: bulkAction,
        caseIds: Array.from(selected),
        ...(targetSectionId ? { targetSectionId } : {}),
      };
      const result = await api<BulkCasesResult>(`/api/projects/${projectId}/cases/bulk`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSelected(new Set());
      setTargetSectionId("");
      // Refresh list
      const url = statusFilter ? `/api/sections/${sectionId}/cases?status=${encodeURIComponent(statusFilter)}` : `/api/sections/${sectionId}/cases`;
      const refreshed = await api<(TestCase & { steps?: unknown[]; status?: string })[]>(url);
      setCases(refreshed);
      const count = "deleted" in result ? result.deleted : "moved" in result ? result.moved : result.copied;
      setImportResult(null);
      setBulkSuccess(`${bulkAction.charAt(0).toUpperCase() + bulkAction.slice(1)}: ${count} case(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBulkWorking(false);
    }
  }

  if (!sectionId) return null;
  if (loading) return <LoadingSpinner />;

  const allSelected = cases.length > 0 && selected.size === cases.length;
  const someSelected = selected.size > 0;
  const needsTarget = bulkAction === "move" || bulkAction === "copy";

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
        <span className="text-sm text-muted">Import CSV:</span>
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
            <span className="text-sm text-muted">New from template:</span>
            <Select
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (id) navigate(`/sections/${sectionId}/cases/new?templateId=${id}`);
              }}
            >
              <option value="">— Choose —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </>
        )}
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-4">
        <label className="text-sm text-muted">
          Filter by status:{" "}
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="approved">Approved</option>
          </Select>
        </label>
      </div>

      {/* Bulk action bar — only visible when cases are selected */}
      {someSelected && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2">
          <span className="text-sm font-medium text-text">{selected.size} selected</span>
          <Select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value as "delete" | "move" | "copy")}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
          >
            <option value="delete">Delete</option>
            <option value="move">Move to section</option>
            <option value="copy">Copy to section</option>
          </Select>
          {needsTarget && siblingsSections.length > 0 && (
            <Select
              value={targetSectionId}
              onChange={(e) => setTargetSectionId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
            >
              <option value="">— Target section —</option>
              {siblingsSections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          )}
          {needsTarget && siblingsSections.length === 0 && (
            <span className="text-xs text-muted">No other sections in this suite</span>
          )}
          <Button
            variant="primary"
            onClick={handleBulkSubmit}
            disabled={bulkWorking || (needsTarget && !targetSectionId)}
          >
            {bulkWorking ? "Working..." : "Apply"}
          </Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())} disabled={bulkWorking}>
            Clear
          </Button>
        </div>
      )}

      {error && <p className="mb-2 text-sm text-error">{error}</p>}
      {bulkSuccess && <p className="mb-2 text-sm text-success">{bulkSuccess}</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[400px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-raised">
              <th className="w-8 px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleAll}
                  aria-label="Select all cases"
                />
              </th>
              <th className="px-3 py-2 text-left font-semibold text-muted">Title</th>
              <th className="px-3 py-2 text-left font-semibold text-muted">Status</th>
              <th className="w-20 px-3 py-2 text-right font-semibold text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr
                key={c.id}
                className={`border-b border-border hover:bg-surface-raised/60 ${selected.has(c.id) ? "bg-primary/5" : ""}`}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    aria-label={`Select case ${c.title || "(Untitled)"}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <Link to={`/cases/${c.id}/edit`} className="text-primary hover:underline">{c.title || "(Untitled)"}</Link>
                </td>
                <td className="px-3 py-2">
                  {c.status ? (
                    <StatusBadge status={c.status as "draft" | "ready" | "approved"} />
                  ) : (
                    <span className="text-muted">—</span>
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
      {importResult && importResult.created > 0 && (
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
