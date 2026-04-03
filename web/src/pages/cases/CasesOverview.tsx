import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { api, type Project, type Suite, type Section, type TestCase, type CaseSummary, type Priority, type CaseType } from "../../api";
import { useProject } from "../../ProjectContext";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { Select } from "../../components/ui/Select";

function buildTree(sections: Section[]): (Section & { children: ReturnType<typeof buildTree> })[] {
  const byParent = new Map<string | null, Section[]>();
  for (const s of sections) {
    const key = s.parentId ?? "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(s);
  }
  function children(parentId: string | null): (Section & { children: ReturnType<typeof children> })[] {
    const list = byParent.get(parentId ?? "root") ?? [];
    return list.map((s) => ({ ...s, children: children(s.id) }));
  }
  return children(null);
}

/** Build case ID -> display ID (C1, C2, …) in tree order */
function buildCaseDisplayIds(
  tree: (Section & { children: (Section & { children: unknown[] })[] })[],
  casesBySection: Map<string, TestCase[]>
): Map<string, string> {
  const out = new Map<string, string>();
  let index = 0;
  function walk(sections: (Section & { children: (Section & { children: unknown[] })[] })[]) {
    for (const sec of sections) {
      const list = (casesBySection.get(sec.id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
      for (const c of list) {
        index += 1;
        out.set(c.id, `C${index}`);
      }
      walk(sec.children as (Section & { children: (Section & { children: unknown[] })[] })[]);
    }
  }
  walk(tree);
  return out;
}

type SectionWithChildren = Section & { children: SectionWithChildren[] };

type SortOption = "section" | "title-asc" | "title-desc" | "status" | "priority";

const STATUS_ORDER: Record<string, number> = { draft: 0, ready: 1, approved: 2 };

export default function CasesOverview() {
  const { projectId, setProjectId } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [summaries, setSummaries] = useState<Record<string, CaseSummary | null>>({});
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState("");

  const [, setProject] = useState<Project | null>(null);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [collapseAll, setCollapseAll] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
  const [sortBy, setSortBy] = useState<SortOption>("section");
  const [statusFilter, setStatusFilter] = useState<"" | "draft" | "ready" | "approved">("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [addingSubsectionUnder, setAddingSubsectionUnder] = useState<string | null>(null);
  const [newSubsectionName, setNewSubsectionName] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState("");

  const currentProject = projectId ? projects.find((p) => p.id === projectId) : null;
  const currentSummary = projectId ? summaries[projectId] : undefined;

  useEffect(() => {
    api<Project[]>("/api/projects")
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (projects.length === 0) return;
    const next: Record<string, CaseSummary | null> = {};
    let done = 0;
    const total = projects.length;
    projects.forEach((p) => {
      api<CaseSummary>(`/api/projects/${p.id}/cases/summary`)
        .then((s) => { next[p.id] = s; })
        .catch(() => { next[p.id] = null; })
        .finally(() => {
          done += 1;
          if (done === total) setSummaries((prev) => ({ ...prev, ...next }));
        });
    });
  }, [projects]);

  useEffect(() => {
    if (!projectId || !currentProject) return;
    setSummaryLoading(true);
    api<CaseSummary>(`/api/projects/${projectId}/cases/summary`)
      .then((s) => setSummaries((prev) => ({ ...prev, [projectId]: s })))
      .catch(() => setSummaries((prev) => ({ ...prev, [projectId]: null })))
      .finally(() => setSummaryLoading(false));
  }, [projectId, currentProject]);

  const loadOverview = useCallback(() => {
    if (!projectId) return;
    setOverviewLoading(true);
    setOverviewError("");
    Promise.all([
      api<Project>(`/api/projects/${projectId}`),
      api<Suite[]>(`/api/projects/${projectId}/suites`),
      api<TestCase[]>(statusFilter ? `/api/projects/${projectId}/cases?status=${statusFilter}` : `/api/projects/${projectId}/cases`),
    ])
      .then(([p, sList, casesList]) => {
        setProject(p);
        setSuites(sList);
        setCases(casesList);
        if (sList.length === 0) {
          setSections([]);
          return;
        }
        return api<Section[]>(`/api/suites/${sList[0].id}/sections`).then(setSections);
      })
      .catch((err) => setOverviewError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setOverviewLoading(false));
  }, [projectId, statusFilter]);

  useEffect(() => {
    if (!projectId) return;
    loadOverview();
  }, [projectId, loadOverview]);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      api<Priority[]>(`/api/projects/${projectId}/priorities`),
      api<CaseType[]>(`/api/projects/${projectId}/case-types`),
    ])
      .then(([p, t]) => {
        setPriorities(p);
        setCaseTypes(t);
      })
      .catch(() => {
        setPriorities([]);
        setCaseTypes([]);
      });
  }, [projectId]);

  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cases.filter((c) => {
      if (priorityFilter && c.priorityId !== priorityFilter) return false;
      if (caseTypeFilter && c.caseTypeId !== caseTypeFilter) return false;
      if (q) {
        const title = (c.title ?? "").toLowerCase();
        const prerequisite = (c.prerequisite ?? "").toLowerCase();
        if (!title.includes(q) && !prerequisite.includes(q)) return false;
      }
      return true;
    });
  }, [cases, priorityFilter, caseTypeFilter, searchQuery]);

  const casesBySection = useMemo(() => {
    const m = new Map<string, TestCase[]>();
    for (const c of filteredCases) {
      const list = m.get(c.sectionId) ?? [];
      list.push(c);
      m.set(c.sectionId, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return m;
  }, [filteredCases]);

  const treeForMemo = useMemo(() => buildTree(sections), [sections]);

  const priorityOrderMap = useMemo(() => {
    const m = new Map<string, number>();
    priorities.forEach((p) => m.set(p.id, p.sortOrder));
    return m;
  }, [priorities]);

  const sortedTree = useMemo(() => {
    if (sortBy !== "title-asc" && sortBy !== "title-desc") return treeForMemo;
    const sign = sortBy === "title-asc" ? 1 : -1;
    function sortSections(nodes: SectionWithChildren[]): SectionWithChildren[] {
      return [...nodes].sort((a, b) => sign * a.name.localeCompare(b.name, undefined, { sensitivity: "base" })).map((s) => ({ ...s, children: sortSections(s.children) }));
    }
    return sortSections(treeForMemo) as typeof treeForMemo;
  }, [treeForMemo, sortBy]);

  const caseDisplayIds = useMemo(() => buildCaseDisplayIds(sortedTree, casesBySection), [sortedTree, casesBySection]);

  function sortCasesList(list: TestCase[]): TestCase[] {
    const sorted = [...list];
    if (sortBy === "section") {
      sorted.sort((a, b) => a.sortOrder - b.sortOrder);
    } else if (sortBy === "title-asc" || sortBy === "title-desc") {
      const sign = sortBy === "title-asc" ? 1 : -1;
      sorted.sort((a, b) => sign * (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }));
    } else if (sortBy === "status") {
      sorted.sort((a, b) => (STATUS_ORDER[a.status ?? ""] ?? 99) - (STATUS_ORDER[b.status ?? ""] ?? 99) || a.sortOrder - b.sortOrder);
    } else if (sortBy === "priority") {
      sorted.sort((a, b) => (priorityOrderMap.get(a.priorityId ?? "") ?? 999) - (priorityOrderMap.get(b.priorityId ?? "") ?? 999) || a.sortOrder - b.sortOrder);
    }
    return sorted;
  }

  function totalCaseCount(section: SectionWithChildren): number {
    const direct = (casesBySection.get(section.id) ?? []).length;
    const childTotal = section.children.reduce((sum, ch) => sum + totalCaseCount(ch), 0);
    return direct + childTotal;
  }

  async function addRootSection(e: React.FormEvent) {
    e.preventDefault();
    if (!suite?.id || !newSectionName.trim()) return;
    setSaving(true);
    try {
      await api(`/api/suites/${suite.id}/sections`, {
        method: "POST",
        body: JSON.stringify({ name: newSectionName.trim() }),
      });
      setNewSectionName("");
      setShowAddSection(false);
      loadOverview();
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : "Failed to add section");
    } finally {
      setSaving(false);
    }
  }

  async function addSubSection(e: React.FormEvent) {
    e.preventDefault();
    if (!addingSubsectionUnder || !newSubsectionName.trim()) return;
    setSaving(true);
    try {
      await api(`/api/sections/${addingSubsectionUnder}/sections`, {
        method: "POST",
        body: JSON.stringify({ name: newSubsectionName.trim() }),
      });
      setNewSubsectionName("");
      setAddingSubsectionUnder(null);
      loadOverview();
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : "Failed to add subsection");
    } finally {
      setSaving(false);
    }
  }

  async function saveSectionName(sectionId: string) {
    if (!editingSectionName.trim()) {
      setEditingSectionId(null);
      return;
    }
    setSaving(true);
    try {
      await api(`/api/sections/${sectionId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editingSectionName.trim() }),
      });
      setEditingSectionId(null);
      setEditingSectionName("");
      loadOverview();
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : "Failed to update section");
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteSection(section: SectionWithChildren) {
    const caseCount = totalCaseCount(section);
    const subsectionCount = section.children.length;
    const parts: string[] = [];
    if (caseCount > 0) parts.push(`${caseCount} case(s)`);
    if (subsectionCount > 0) parts.push(`${subsectionCount} subsection(s)`);
    const message =
      parts.length > 0
        ? `Section "${section.name}" contains ${parts.join(" and ")}. Deleting it will permanently delete all of them. Are you sure?`
        : `Delete section "${section.name}"?`;
    if (!window.confirm(message)) return;
    setSaving(true);
    api(`/api/sections/${section.id}`, { method: "DELETE" })
      .then(() => loadOverview())
      .catch((err) => setOverviewError(err instanceof Error ? err.message : "Failed to delete section"))
      .finally(() => setSaving(false));
  }

  function handleDeleteCase(c: TestCase) {
    const title = c.title || "(Untitled)";
    if (!window.confirm(`Delete test case "${title}"?`)) return;
    setSaving(true);
    api(`/api/cases/${c.id}`, { method: "DELETE" })
      .then(() => loadOverview())
      .catch((err) => setOverviewError(err instanceof Error ? err.message : "Failed to delete case"))
      .finally(() => setSaving(false));
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-error">{error}</p>;

  if (!projectId || !currentProject) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Test Cases</h1>
        <p className="mt-1 text-muted">Select a project to view and manage test cases.</p>
        {projects.length === 0 ? (
          <Card className="mt-8 rounded-xl border-border/80 bg-surface-raised/40 shadow-sm">
            <EmptyState
              message="No projects yet. Create a project to add test cases."
              action={<Link to="/projects" className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover">Go to projects</Link>}
            />
          </Card>
        ) : (
          <Card className="mt-8 overflow-hidden rounded-xl border-border/80 p-0 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-raised/40">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Project</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted w-24">Total</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted w-20">Draft</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted w-20">Ready</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted w-24">Approved</th>
                    <th className="w-28 px-5 py-3" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {projects.map((p) => {
                    const sum = summaries[p.id];
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-surface-raised/60">
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => setProjectId(p.id)}
                            className="font-medium text-text no-underline hover:text-primary hover:underline"
                          >
                            {p.name}
                          </button>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted">{sum != null ? sum.total : "—"}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted">{sum != null ? sum.draft : "—"}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-primary">{sum != null ? sum.ready : "—"}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-emerald-600">{sum != null ? sum.approved : "—"}</td>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => setProjectId(p.id)}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-primary-hover"
                          >
                            Overview
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  }

  const suite = suites[0] ?? null;
  const isSectionExpanded = (sectionId: string) => !collapseAll && !collapsedSections.has(sectionId);
  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  function SectionBlock({
    section,
    depth,
    caseDisplayIdsMap,
    onDeleteSection,
    onDeleteCase,
  }: {
    section: SectionWithChildren;
    depth: number;
    caseDisplayIdsMap: Map<string, string>;
    onDeleteSection: (s: SectionWithChildren) => void;
    onDeleteCase: (c: TestCase) => void;
  }) {
    const isExpanded = isSectionExpanded(section.id);
    const sectionCases = sortCasesList(casesBySection.get(section.id) ?? []);
    const count = totalCaseCount(section);
    const isEditing = editingSectionId === section.id;

    return (
      <div key={section.id} className="mb-5" style={{ marginLeft: depth * 24 }}>
        <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-surface-raised/40 px-3 py-2 transition hover:bg-surface-raised/60">
          <button
            type="button"
            onClick={() => toggleSection(section.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-surface-raised hover:text-muted"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <svg className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isEditing ? (
            <form
              onSubmit={(e) => { e.preventDefault(); saveSectionName(section.id); }}
              className="flex flex-1 items-center gap-2"
            >
              <input
                value={editingSectionName}
                onChange={(e) => setEditingSectionName(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface-raised text-text px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
              <button type="submit" disabled={saving} className="text-sm font-medium text-primary hover:underline">Save</button>
              <button type="button" className="text-sm text-muted hover:underline" onClick={() => { setEditingSectionId(null); setEditingSectionName(""); }}>Cancel</button>
            </form>
          ) : (
            <>
              <span className="font-medium text-text">{section.name}</span>
              <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium tabular-nums text-muted">{count}</span>
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => { setEditingSectionId(section.id); setEditingSectionName(section.name); }}
                  className="rounded p-1.5 text-muted transition hover:bg-surface-raised hover:text-muted"
                  aria-label="Edit section"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSection(section)}
                  disabled={saving}
                  className="rounded p-1.5 text-muted transition hover:bg-error/20 hover:text-error disabled:opacity-50"
                  aria-label="Delete section"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </>
          )}
        </div>

        {isExpanded && (
          <>
            <div className="mt-2 overflow-hidden rounded-lg border border-border/80 shadow-sm">
              <table className="w-full min-w-[400px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-raised/40">
                    <th className="w-14 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted">ID</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted">Title</th>
                    <th className="w-24 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted">Status</th>
                    <th className="w-32 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sectionCases.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-surface-raised/60">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted">{caseDisplayIdsMap.get(c.id) ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <Link to={`/cases/${c.id}/edit`} className="font-medium text-primary no-underline hover:underline">{c.title || "(Untitled)"}</Link>
                      </td>
                      <td className="px-4 py-2.5">
                        {c.status ? (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.status === "approved" ? "bg-emerald-100 text-emerald-800" : c.status === "ready" ? "bg-primary/20 text-primary" : "bg-surface-raised text-muted"}`}>
                            {c.status}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link to={`/cases/${c.id}/edit`} className="mr-3 text-sm font-medium text-primary hover:underline">Edit</Link>
                        <button
                          type="button"
                          onClick={() => onDeleteCase(c)}
                          disabled={saving}
                          className="text-sm font-medium text-error hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-sm text-muted">
              <Link to={`/sections/${section.id}/cases/new`} className="hover:text-primary hover:underline">
                Add case
              </Link>
              <span className="text-muted">·</span>
              <button
                type="button"
                onClick={() => setAddingSubsectionUnder(section.id)}
                className="hover:text-primary hover:underline"
              >
                Add subsection
              </button>
              {addingSubsectionUnder === section.id && (
                <form onSubmit={addSubSection} className="ml-2 inline-flex items-center gap-1.5">
                  <input
                    value={newSubsectionName}
                    onChange={(e) => setNewSubsectionName(e.target.value)}
                    placeholder="Name"
                    className="w-32 rounded-md border border-border bg-surface-raised text-text px-2 py-1 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                  <button type="submit" disabled={saving} className="text-sm font-medium text-primary hover:underline disabled:opacity-50">Add</button>
                  <button type="button" className="text-sm text-muted hover:underline" onClick={() => { setAddingSubsectionUnder(null); setNewSubsectionName(""); }}>Cancel</button>
                </form>
              )}
            </div>
            {section.children.map((ch) => (
              <SectionBlock key={ch.id} section={ch} depth={depth + 1} caseDisplayIdsMap={caseDisplayIdsMap} onDeleteSection={onDeleteSection} onDeleteCase={onDeleteCase} />
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text font-mono">Test Cases</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-surface-raised px-2 py-0.5 text-sm font-medium text-muted">{currentProject.name}</span>
            {currentSummary != null && (
              <span className="text-sm text-muted">
                {sections.length} section{sections.length !== 1 ? "s" : ""} · {currentSummary.total} case{currentSummary.total !== 1 ? "s" : ""}
                {(priorityFilter || caseTypeFilter || searchQuery.trim()) && (
                  <> · showing {filteredCases.length} matching</>
                )}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setProjectId(null)}
          className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium text-muted shadow-sm transition hover:bg-surface-raised"
        >
          View all projects
        </button>
      </div>

      {summaryLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="rounded-xl border-border/80 p-5 shadow-sm transition hover:shadow">
              <div className="text-2xl font-bold tabular-nums tracking-tight text-text">{currentSummary?.total ?? "—"}</div>
              <div className="mt-0.5 text-sm font-medium text-muted">Total cases</div>
            </Card>
            <Card className="rounded-xl border-border/80 p-5 shadow-sm transition hover:shadow">
              <div className="text-2xl font-bold tabular-nums tracking-tight text-muted">{currentSummary?.draft ?? "—"}</div>
              <div className="mt-0.5 text-sm font-medium text-muted">Draft</div>
            </Card>
            <Card className="rounded-xl border-border/80 p-5 shadow-sm transition hover:shadow">
              <div className="text-2xl font-bold tabular-nums tracking-tight text-primary">{currentSummary?.ready ?? "—"}</div>
              <div className="mt-0.5 text-sm font-medium text-muted">Ready</div>
            </Card>
            <Card className="rounded-xl border-border/80 p-5 shadow-sm transition hover:shadow">
              <div className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600">{currentSummary?.approved ?? "—"}</div>
              <div className="mt-0.5 text-sm font-medium text-muted">Approved</div>
            </Card>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-surface-raised/40 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Sort</span>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="section">Section</option>
                <option value="title-asc">Title (A–Z)</option>
                <option value="title-desc">Title (Z–A)</option>
                <option value="status">Status</option>
                <option value="priority">Priority</option>
              </Select>
            </div>
            <div className="h-4 w-px bg-border" aria-hidden />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Filter</span>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter((e.target.value || "") as "" | "draft" | "ready" | "approved")}
              >
                <option value="">None</option>
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="approved">Approved</option>
              </Select>
              <Select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="">All priorities</option>
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
              <Select
                value={caseTypeFilter}
                onChange={(e) => setCaseTypeFilter(e.target.value)}
              >
                <option value="">All types</option>
                {caseTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
            <div className="h-4 w-px bg-border" aria-hidden />
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Search</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Title or prerequisite..."
                className="w-44 rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm shadow-sm placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-56"
                aria-label="Search cases by title or prerequisite"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCollapseAll((c) => !c)}
                className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-medium text-muted shadow-sm transition hover:bg-surface-raised"
              >
                {collapseAll ? "Expand All" : "Collapse All"}
              </button>
              <Link to={suite ? `/suites/${suite.id}` : "#"} className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-medium text-muted no-underline shadow-sm transition hover:bg-surface-raised">
                Manage sections
              </Link>
            </div>
          </div>

          {overviewError && (
            <div className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {overviewError}
            </div>
          )}
          {overviewLoading ? (
            <LoadingSpinner />
          ) : suites.length === 0 ? (
            <Card className="rounded-xl border-border/80 p-8 shadow-sm">
              <EmptyState
                message="No test suite yet. Create a suite in the project to add sections and cases."
                action={<Link to={`/projects/${projectId}`} className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover">Go to project</Link>}
              />
            </Card>
          ) : (
            <Card className="rounded-xl border-border/80 p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-4">
                {showAddSection ? (
                  <form onSubmit={addRootSection} className="flex flex-wrap items-center gap-2">
                    <input
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="New section name"
                      className="rounded-md border border-border bg-surface-raised text-text px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      autoFocus
                    />
                    <button type="submit" disabled={saving} className="text-sm font-medium text-primary hover:underline disabled:opacity-50">
                      Add
                    </button>
                    <button
                      type="button"
                      className="text-sm text-muted hover:underline"
                      onClick={() => { setShowAddSection(false); setNewSectionName(""); }}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddSection(true)}
                    className="text-sm text-muted hover:text-primary hover:underline"
                  >
                    + Add section
                  </button>
                )}
              </div>
              {treeForMemo.length === 0 && !showAddSection ? (
                <div className="rounded-lg border border-dashed border-border bg-surface-raised/40 py-12 text-center text-sm text-muted">
                  No sections yet. Click &quot;+ Add section&quot; above to create one.
                </div>
              ) : (
                sortedTree.map((s) => (
                  <SectionBlock
                    key={s.id}
                    section={s}
                    depth={0}
                    caseDisplayIdsMap={caseDisplayIds}
                    onDeleteSection={handleDeleteSection}
                    onDeleteCase={handleDeleteCase}
                  />
                ))
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
