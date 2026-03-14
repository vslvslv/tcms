import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Project } from "../api";
import { Button, SubmitButton } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageTitle } from "../components/ui/PageTitle";
import { SectionHeading } from "../components/ui/SectionHeading";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api<Project[]>("/api/projects")
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      setNewName("");
      setNewDesc("");
      setShowNew(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageTitle>Projects</PageTitle>
        {!showNew && (
          <Button variant="primary" onClick={() => setShowNew(true)}>
            New project
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {error}
        </div>
      )}

      {showNew && (
        <Card className="mb-6">
          <SectionHeading className="mb-4">New project</SectionHeading>
          <form onSubmit={createProject} className="space-y-4" data-testid="new-project-form">
            <div>
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                placeholder="Project name"
              />
            </div>
            <div>
              <Label htmlFor="project-desc">Description</Label>
              <Input
                id="project-desc"
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional short description"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton disabled={saving}>
                {saving ? "Creating…" : "Create project"}
              </SubmitButton>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowNew(false);
                  setNewName("");
                  setNewDesc("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading && <LoadingSpinner />}

      {!loading && !error && projects.length > 0 && (
        <Card className="overflow-hidden p-0" data-testid="projects-list">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Updated</th>
                  <th className="w-28 px-4 py-3 text-right font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to={`/projects/${p.id}`} className="font-medium text-primary hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted-foreground" title={p.description ?? undefined}>
                      {p.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/projects/${p.id}`}
                        className="text-primary hover:underline"
                      >
                        View
                      </Link>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <Link
                        to={`/projects/${p.id}/settings`}
                        className="text-muted-foreground hover:underline"
                      >
                        Settings
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && projects.length === 0 && !error && !showNew && (
        <Card>
          <EmptyState
            message="No projects yet. Create your first project to manage test cases, runs, and plans."
            action={<Button variant="primary" onClick={() => setShowNew(true)}>New project</Button>}
          />
        </Card>
      )}
    </div>
  );
}
