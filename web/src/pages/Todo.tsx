import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Flag, FolderOpen } from "lucide-react";
import { api, type Project, type TestCase, type ProjectRun } from "../api";
import { useAuth } from "../AuthContext";
import { Card } from "../components/ui/Card";
import { PageTitle } from "../components/ui/PageTitle";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

type CaseWithProject = TestCase & { projectId: string; projectName: string };
type RunWithProject = ProjectRun & { projectName: string };

async function fetchBatched<T>(items: string[], fn: (id: string) => Promise<T[]>, batchSize = 5): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    for (const r of batchResults) results.push(...r);
  }
  return results;
}

export default function Todo() {
  const { user } = useAuth();
  const [readyCases, setReadyCases] = useState<CaseWithProject[]>([]);
  const [openRuns, setOpenRuns] = useState<RunWithProject[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    api<Project[]>("/api/projects")
      .then(async (projects) => {
        if (projects.length === 0) {
          setLoadingCases(false);
          setLoadingRuns(false);
          return;
        }

        const projectIds = projects.map((p) => p.id);
        const projectMap = new Map(projects.map((p) => [p.id, p.name]));

        // Section 1: Cases with status=ready (batched, 5 at a time)
        fetchBatched<CaseWithProject>(
          projectIds,
          async (pid) => {
            try {
              const suites = await api<{ id: string }[]>(`/api/projects/${pid}/suites`);
              if (!suites.length) return [];
              const allCases: CaseWithProject[] = [];
              for (const suite of suites) {
                const sections = await api<{ id: string }[]>(`/api/suites/${suite.id}/sections`);
                for (const sec of sections) {
                  const cases = await api<TestCase[]>(`/api/sections/${sec.id}/cases?status=ready`);
                  for (const c of cases) {
                    allCases.push({ ...c, projectId: pid, projectName: projectMap.get(pid) ?? pid });
                  }
                }
              }
              return allCases;
            } catch {
              return [];
            }
          },
          5
        )
          .then(setReadyCases)
          .catch(() => setError("Failed to load cases"))
          .finally(() => setLoadingCases(false));

        // Section 2: Open runs (batched, 5 at a time)
        fetchBatched<RunWithProject>(
          projectIds,
          async (pid) => {
            try {
              const runs = await api<ProjectRun[]>(`/api/projects/${pid}/runs?is_completed=false`);
              return runs.map((r) => ({ ...r, projectName: projectMap.get(pid) ?? pid }));
            } catch {
              return [];
            }
          },
          5
        )
          .then(setOpenRuns)
          .catch(() => {})
          .finally(() => setLoadingRuns(false));
      })
      .catch(() => {
        setError("Failed to load projects");
        setLoadingCases(false);
        setLoadingRuns(false);
      });
  }, [user]);

  const bothEmpty = !loadingCases && !loadingRuns && readyCases.length === 0 && openRuns.length === 0;

  return (
    <div className="max-w-3xl">
      <PageTitle>Needs Attention</PageTitle>

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      {bothEmpty ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-muted">
          <CheckCircle className="h-10 w-10 opacity-40" />
          <span className="text-base font-medium">You&apos;re all caught up.</span>
          <span className="text-sm">Nothing needs your attention right now.</span>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Cases to review */}
          <Card>
            <div className="mb-3 flex items-center gap-2 px-4 pt-4">
              <Flag className="h-4 w-4 text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Cases to review</h2>
            </div>
            {loadingCases ? (
              <div className="space-y-2 px-4 pb-4">
                {[0, 1].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-surface-raised" />
                ))}
              </div>
            ) : readyCases.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted">No cases awaiting review.</p>
            ) : (
              <ul className="divide-y divide-border px-4 pb-4">
                {readyCases.slice(0, 50).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <Flag className="h-3.5 w-3.5 shrink-0 text-warning" />
                    <Link to={`/cases/${c.id}/edit`} className="min-w-0 flex-1 truncate text-sm text-primary hover:underline">
                      {c.title}
                    </Link>
                    <span className="shrink-0 rounded bg-surface-raised px-1.5 py-0.5 text-xs text-muted">{c.projectName}</span>
                  </li>
                ))}
                {readyCases.length > 50 && (
                  <li className="py-2 text-xs text-muted">+{readyCases.length - 50} more</li>
                )}
              </ul>
            )}
          </Card>

          {/* Open test runs */}
          <Card>
            <div className="mb-3 flex items-center gap-2 px-4 pt-4">
              <FolderOpen className="h-4 w-4 text-muted" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Open test runs</h2>
            </div>
            {loadingRuns ? (
              <div className="space-y-2 px-4 pb-4">
                {[0, 1].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-surface-raised" />
                ))}
              </div>
            ) : openRuns.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted">No open test runs.</p>
            ) : (
              <ul className="divide-y divide-border px-4 pb-4">
                {openRuns.slice(0, 50).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <Link to={`/runs/${r.id}`} className="min-w-0 flex-1 truncate text-sm text-primary hover:underline">
                      {r.name}
                    </Link>
                    <span className="shrink-0 rounded bg-surface-raised px-1.5 py-0.5 text-xs text-muted">{r.projectName}</span>
                  </li>
                ))}
                {openRuns.length > 50 && (
                  <li className="py-2 text-xs text-muted">+{openRuns.length - 50} more</li>
                )}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
