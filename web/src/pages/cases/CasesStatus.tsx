import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Project, type TestCase } from "../../api";
import { useProject } from "../../ProjectContext";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { PageTitle } from "../../components/ui/PageTitle";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";

type StatusFilter = "all" | "draft" | "ready" | "approved";

export default function CasesStatus() {
  const { projectId: contextProjectId } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Project[]>("/api/projects")
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (projectId !== "" || !contextProjectId || projects.length === 0) return;
    if (projects.some((p) => p.id === contextProjectId)) setProjectId(contextProjectId);
  }, [projectId, contextProjectId, projects]);

  useEffect(() => {
    if (!projectId) {
      setCases([]);
      return;
    }
    setLoading(true);
    setError("");
    const statusParam = statusFilter === "all" ? undefined : statusFilter;
    const url = statusParam ? `/api/projects/${projectId}/cases?status=${statusParam}` : `/api/projects/${projectId}/cases`;
    api<TestCase[]>(url)
      .then(setCases)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
        setCases([]);
      })
      .finally(() => setLoading(false));
  }, [projectId, statusFilter]);

  const currentProject = projects.find((p) => p.id === projectId);

  return (
    <div className="max-w-4xl">
      <PageTitle className="mb-2">Test cases — Status</PageTitle>
      <p className="mb-6 text-muted">View test cases by status (draft, ready, approved).</p>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted">Project</span>
            <Select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">— Select project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted">Status</span>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="approved">Approved</option>
            </Select>
          </label>
        </div>
      </Card>

      {error && <p className="mb-4 text-error">{error}</p>}

      {!projectId && (
        <Card>
          <EmptyState message="Select a project to view cases by status." />
        </Card>
      )}

      {projectId && loading && <LoadingSpinner />}

      {projectId && !loading && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-muted">
            {currentProject?.name} — {statusFilter === "all" ? "All statuses" : statusFilter}
          </div>
          {cases.length === 0 ? (
            <div className="p-6 text-center text-muted">No cases match the selected filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-raised">
                    <th className="px-4 py-2 text-left font-semibold text-muted">Title</th>
                    <th className="px-4 py-2 text-left font-semibold text-muted">Status</th>
                    <th className="w-24 px-4 py-2 text-right font-semibold text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-b border-border hover:bg-surface-raised/60">
                      <td className="px-4 py-2">
                        <Link to={`/cases/${c.id}/edit`} className="font-medium text-primary hover:underline">{c.title || "(Untitled)"}</Link>
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={(c.status ?? "draft") as "draft" | "ready" | "approved"} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link to={`/cases/${c.id}/edit`} className="text-primary hover:underline">Edit</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
