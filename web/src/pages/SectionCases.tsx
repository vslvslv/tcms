import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, getToken, type TestCase, type CaseTemplate, type Section, type Suite } from "../api";

export default function SectionCases() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const navigate = useNavigate();
  const [cases, setCases] = useState<(TestCase & { steps?: unknown[] })[]>([]);
  const [templates, setTemplates] = useState<CaseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (!sectionId) return;
    const url = statusFilter ? `/api/sections/${sectionId}/cases?status=${encodeURIComponent(statusFilter)}` : `/api/sections/${sectionId}/cases`;
    api<(TestCase & { steps?: unknown[] })[]>(url)
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
  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 24 }}>
        <Link to="/projects">Projects</Link> → Section cases
      </header>
      <p>
        <Link to={`/sections/${sectionId}/cases/new`}>Add case</Link>
        {" "}
        |{" "}
        <button
          type="button"
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
        </button>
        {" "}
        | Import CSV:{" "}
        <input
          type="file"
          accept=".csv"
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
                const list = await api<(TestCase & { steps?: unknown[] })[]>(`/api/sections/${sectionId}/cases`);
                setCases(list);
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : "Import failed");
            }
          }}
        />
        {templates.length > 0 && (
          <>
            {" "}
            | New from template:{" "}
            <select
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
            </select>
          </>
        )}
      </p>
      <p style={{ marginBottom: 8 }}>
        Filter by status:{" "}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="ready">Ready</option>
          <option value="approved">Approved</option>
        </select>
      </p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {cases.map((c) => (
          <li key={c.id} style={{ marginBottom: 8 }}>
            <Link to={`/cases/${c.id}/edit`}>{c.title}</Link>
            {(c as TestCase & { status?: string }).status && (
              <span style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>
                ({(c as TestCase & { status?: string }).status})
              </span>
            )}
          </li>
        ))}
      </ul>
      {importResult && (
        <p style={{ marginTop: 16 }}>
          Import: {importResult.created} created.
          {importResult.errors.length > 0 && ` ${importResult.errors.length} error(s): ${importResult.errors.map((e) => `Row ${e.row}: ${e.message}`).join("; ")}`}
        </p>
      )}
      {cases.length === 0 && !importResult && <p>No cases yet.</p>}
    </div>
  );
}
