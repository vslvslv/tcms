import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Project, type TestCase } from "../../api";
import { useProject } from "../../ProjectContext";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { PageTitle } from "../../components/ui/PageTitle";
import { Select } from "../../components/ui/Select";

export default function CasesDefects() {
  const { projectId: contextProjectId } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
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
    api<TestCase[]>(`/api/projects/${projectId}/cases/with-defects`)
      .then(setCases)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
        setCases([]);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const currentProject = projects.find((p) => p.id === projectId);

  return (
    <div className="max-w-4xl">
      <PageTitle className="mb-2">Test cases — Defects</PageTitle>
      <p className="mb-6 text-muted">Test cases that have at least one defect or issue link.</p>

      <Card className="mb-6">
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
      </Card>

      {error && <p className="mb-4 text-error">{error}</p>}

      {!projectId && (
        <Card>
          <EmptyState message="Select a project to view cases with linked defects." />
        </Card>
      )}

      {projectId && loading && <LoadingSpinner />}

      {projectId && !loading && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-muted">
            {currentProject?.name} — Cases with defects
          </div>
          {cases.length === 0 ? (
            <div className="p-6 text-center text-muted">No cases with defect links in this project.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-raised">
                    <th className="px-4 py-2 text-left font-semibold text-muted">Title</th>
                    <th className="w-24 px-4 py-2 text-right font-semibold text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-b border-border hover:bg-surface-raised/60">
                      <td className="px-4 py-2">
                        <Link to={`/cases/${c.id}/edit`} className="font-medium text-primary hover:underline">{c.title || "(Untitled)"}</Link>
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
