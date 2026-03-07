import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Project, type Suite, type Section } from "../../api";
import { useProject } from "../../ProjectContext";
import { Card } from "../../components/ui/Card";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { PageTitle } from "../../components/ui/PageTitle";

type SectionNode = Section & { children: SectionNode[] };

function buildSectionTree(sections: Section[]): SectionNode[] {
  const byParent = new Map<string | null, Section[]>();
  for (const s of sections) {
    const key = s.parentId ?? "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(s);
  }
  function children(parentId: string | null): SectionNode[] {
    const list = byParent.get(parentId ?? "root") ?? [];
    return list.map((s) => ({ ...s, children: children(s.id) }));
  }
  return children(null);
}

export default function CasesDetails() {
  const { projectId: contextProjectId } = useProject();
  const { projectId: paramProjectId } = useParams<{ projectId?: string }>();
  const projectId = paramProjectId ?? contextProjectId;

  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [sectionsBySuite, setSectionsBySuite] = useState<Record<string, Section[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Project[]>("/api/projects")
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setSuites([]);
      setSectionsBySuite({});
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api<Project>(`/api/projects/${projectId}`),
      api<Suite[]>(`/api/projects/${projectId}/suites`),
    ])
      .then(([p, s]) => {
        setProject(p);
        setSuites(s);
        return Promise.all(s.map((suite) => api<Section[]>(`/api/suites/${suite.id}/sections`).then((sec) => ({ suiteId: suite.id, sections: sec }))));
      })
      .then((results) => {
        const map: Record<string, Section[]> = {};
        for (const { suiteId, sections } of results) map[suiteId] = sections;
        setSectionsBySuite(map);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="max-w-4xl">
        <PageTitle className="mb-2">Test cases — Details</PageTitle>
        <p className="mb-6 text-gray-600">Select a project from the sidebar or below to view sections and cases.</p>
        <Card>
          <ul className="list-none space-y-2 p-0">
            {projects.map((p) => (
              <li key={p.id}>
                <Link to={`/cases/details/${p.id}`} className="font-medium text-primary hover:underline">{p.name}</Link>
              </li>
            ))}
          </ul>
          {projects.length === 0 && <p className="text-muted">No projects.</p>}
        </Card>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;
  if (error || !project) return <p className="text-error">{error || "Project not found"}</p>;

  return (
    <div className="max-w-4xl">
      <PageTitle className="mb-2">Test cases — Details</PageTitle>
      <p className="mb-6 text-gray-600">
        <Link to="/cases/details" className="text-primary hover:underline">All projects</Link>
        {" → "}
        <span className="font-medium">{project.name}</span>
      </p>
      {suites.length === 0 ? (
        <Card>
          <p className="text-muted">No suites. Add a suite from the project page.</p>
          <Link to={`/projects/${projectId}`} className="mt-2 inline-block text-sm text-primary hover:underline">Go to project →</Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {suites.map((suite) => {
            const sections = sectionsBySuite[suite.id] ?? [];
            const tree = buildSectionTree(sections);
            return (
              <Card key={suite.id}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{suite.name}</h2>
                <SectionList tree={tree} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionList({
  tree,
  depth = 0,
}: {
  tree: SectionNode[];
  depth?: number;
}) {
  return (
    <ul className="list-none p-0" style={{ marginLeft: depth * 16 }}>
      {tree.map((s) => (
        <li key={s.id} className="mb-1">
          <Link to={`/sections/${s.id}/cases`} className="text-primary hover:underline">
            {s.name}
          </Link>
          {s.children.length > 0 && <SectionList tree={s.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}
