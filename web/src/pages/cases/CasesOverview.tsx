import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { api, type Project, type Suite, type Section, type TestCase, type CaseSummary, type Priority, type CaseType, type BulkAction, type BulkCasesBody, type BulkCasesResult } from "../../api";
import { useProject } from "../../ProjectContext";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { buildSectionTree, type SectionNode } from "../../lib/sectionTree";

/** Build case ID -> display ID (C1, C2, …) in tree order */
function buildCaseDisplayIds(
  tree: SectionNode[],
  casesBySection: Map<string, TestCase[]>
): Map<string, string> {
  const out = new Map<string, string>();
  let index = 0;
  function walk(sections: SectionNode[]) {
    for (const sec of sections) {
      const list = (casesBySection.get(sec.id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
      for (const c of list) {
        index += 1;
        out.set(c.id, `C${index}`);
      }
      walk(sec.children);
    }
  }
  walk(tree);
  return out;
}

type SortOption = "section" | "title-asc" | "title-desc" | "status" | "priority";

const STATUS_ORDER: Record<string, number> = { draft: 0, ready: 1, approved: 2 };

/** StatusDot — 8px circle, cell-level only (DESIGN.md rule) */
function StatusDot({ status }: { status?: string }) {
  const color =
    status === "approved" ? "var(--color-success)" :
    status === "ready"    ? "var(--color-primary)" :
    status === "draft"    ? "var(--color-muted)" :
                            "var(--color-muted2)";
  return (
    <span
      title={status ?? "—"}
      style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }}
    />
  );
}

/** PriorityBadge — monospaced, tinted border */
function PriorityBadge({ priorityId, priorities }: { priorityId?: string | null; priorities: Priority[] }) {
  const p = priorities.find((pr) => pr.id === priorityId);
  if (!p) return <span className="text-muted text-xs">—</span>;
  const name = p.name.toLowerCase();
  if (name === "high") {
    return (
      <span
        className="inline-flex items-center rounded px-1.5 py-0 text-xs border font-mono"
        style={{ fontSize: 11, color: "var(--color-priority-high)", borderColor: "color-mix(in oklch, var(--color-priority-high) 25%, transparent)", backgroundColor: "color-mix(in oklch, var(--color-priority-high) 10%, transparent)" }}
      >
        {p.name}
      </span>
    );
  }
  const cls =
    name === "critical" ? "bg-error/10 text-error border-error/25" :
    name === "medium"   ? "bg-primary/10 text-primary border-primary/25" :
                          "bg-muted/10 text-muted border-muted/25";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0 text-xs border font-mono ${cls}`} style={{ fontSize: 11 }}>
      {p.name}
    </span>
  );
}

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
  const [sortBy, setSortBy] = useState<SortOption>("section");
  const [statusFilter, setStatusFilter] = useState<"" | "draft" | "ready" | "approved">("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [addingSubsectionUnder, setAddingSubsectionUnder] = useState<string | null>(null);
  const [newSubsectionName, setNewSubsectionName] = useState("");
  const [newSectionName, setNewSectionName] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState("");

  // Bulk selection state (Story 1.7)
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>("move");
  const [bulkTargetSectionId, setBulkTargetSectionId] = useState("");
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");

  // New layout state (must be declared unconditionally — Rules of Hooks)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [addSectionSuiteId, setAddSectionSuiteId] = useState<string | null>(null);

  const currentProject = projectId ? projects.find((p) => p.id === projectId) : null;
  const currentSummary = projectId ? summaries[projectId] : undefined;

  // Reset panel state when switching projects (ISSUE 49)
  useEffect(() => {
    setSelectedCaseId(null);
    setDetailPanelOpen(false);
    setSelectedSectionId(null);
  }, [projectId]);

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

  const loadSummary = useCallback(() => {
    if (!projectId) return;
    api<CaseSummary>(`/api/projects/${projectId}/cases/summary`)
      .then((s) => setSummaries((prev) => ({ ...prev, [projectId]: s })))
      .catch(() => {});
  }, [projectId]);

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
        return Promise.all(sList.map((s) => api<Section[]>(`/api/suites/${s.id}/sections`)))
          .then((allSections) => setSections(allSections.flat()));
      })
      .catch((err) => setOverviewError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setOverviewLoading(false));
  }, [projectId, statusFilter]);

  useEffect(() => {
    setSelectedCaseIds(new Set());
    setBulkError("");
    setBulkSuccess("");
    setBulkTargetSectionId("");
  }, [projectId]);

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

  const treeForMemo = useMemo(() => buildSectionTree(sections), [sections]);

  const priorityOrderMap = useMemo(() => {
    const m = new Map<string, number>();
    priorities.forEach((p) => m.set(p.id, p.sortOrder));
    return m;
  }, [priorities]);

  const sortedTree = useMemo(() => {
    if (sortBy !== "title-asc" && sortBy !== "title-desc") return treeForMemo;
    const sign = sortBy === "title-asc" ? 1 : -1;
    function sortSections(nodes: SectionNode[]): SectionNode[] {
      return [...nodes].sort((a, b) => sign * a.name.localeCompare(b.name, undefined, { sensitivity: "base" })).map((s) => ({ ...s, children: sortSections(s.children) }));
    }
    return sortSections(treeForMemo) as typeof treeForMemo;
  }, [treeForMemo, sortBy]);

  const caseDisplayIds = useMemo(() => buildCaseDisplayIds(sortedTree, casesBySection), [sortedTree, casesBySection]);

  /** Cases for the currently selected section (recursive: includes children) */
  const visibleCases = useMemo(() => {
    if (!selectedSectionId) return filteredCases;
    function collectIds(sec: SectionNode): string[] {
      return [sec.id, ...sec.children.flatMap(collectIds)];
    }
    const node = sortedTree.reduce<SectionNode | null>((found, s) => {
      if (found) return found;
      function find(n: SectionNode): SectionNode | null {
        if (n.id === selectedSectionId) return n;
        for (const ch of n.children) { const r = find(ch); if (r) return r; }
        return null;
      }
      return find(s);
    }, null);
    const ids = node ? new Set(collectIds(node)) : new Set([selectedSectionId]);
    return filteredCases.filter((c) => ids.has(c.sectionId));
  }, [selectedSectionId, filteredCases, sortedTree]);

  // Status bar counts
  const statusCounts = useMemo(() => {
    const draft = visibleCases.filter((c) => c.status === "draft").length;
    const ready = visibleCases.filter((c) => c.status === "ready").length;
    const approved = visibleCases.filter((c) => c.status === "approved").length;
    const none = visibleCases.filter((c) => !c.status).length;
    return { draft, ready, approved, none, total: visibleCases.length };
  }, [visibleCases]);

  const selectedCase = selectedCaseId ? cases.find((c) => c.id === selectedCaseId) ?? null : null;
  const selectedSection = selectedSectionId ? sections.find((s) => s.id === selectedSectionId) ?? null : null;
  const selectedSuite = selectedSection ? suites.find((s) => s.id === selectedSection.suiteId) ?? null : null;

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

  function totalCaseCount(section: SectionNode): number {
    const direct = (casesBySection.get(section.id) ?? []).length;
    const childTotal = section.children.reduce((sum, ch) => sum + totalCaseCount(ch), 0);
    return direct + childTotal;
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

  function handleDeleteSection(section: SectionNode) {
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
      .then(() => { loadOverview(); loadSummary(); })
      .catch((err) => setOverviewError(err instanceof Error ? err.message : "Failed to delete section"))
      .finally(() => setSaving(false));
  }

  function handleDeleteCase(c: TestCase) {
    const title = c.title || "(Untitled)";
    if (!window.confirm(`Delete test case "${title}"?`)) return;
    setSaving(true);
    api(`/api/cases/${c.id}`, { method: "DELETE" })
      .then(() => { loadOverview(); loadSummary(); })
      .catch((err) => setOverviewError(err instanceof Error ? err.message : "Failed to delete case"))
      .finally(() => setSaving(false));
  }

  function handleDuplicateCase(c: TestCase) {
    setSaving(true);
    api<TestCase>(`/api/cases/${c.id}/duplicate`, { method: "POST" })
      .then(() => { loadOverview(); loadSummary(); })
      .catch((err) => setOverviewError(err instanceof Error ? err.message : "Failed to duplicate case"))
      .finally(() => setSaving(false));
  }

  async function handleBulkSubmit() {
    if (selectedCaseIds.size === 0) return;
    if (bulkAction === "delete") {
      if (!window.confirm(`Delete ${selectedCaseIds.size} case(s)? This cannot be undone.`)) return;
    }
    const needsTarget = bulkAction === "move" || bulkAction === "copy";
    if (needsTarget && !bulkTargetSectionId) {
      setBulkError("Select a target section.");
      return;
    }
    setBulkWorking(true);
    setBulkError("");
    setBulkSuccess("");
    try {
      const body: BulkCasesBody = { action: bulkAction, caseIds: Array.from(selectedCaseIds), ...(needsTarget ? { targetSectionId: bulkTargetSectionId } : {}) };
      const count = selectedCaseIds.size;
      await api<BulkCasesResult>(`/api/projects/${projectId}/cases/bulk`, { method: "POST", body: JSON.stringify(body) });
      setSelectedCaseIds(new Set());
      setBulkTargetSectionId("");
      if (bulkAction === "delete") {
        setBulkSuccess(`${count} case${count !== 1 ? "s" : ""} deleted.`);
      } else {
        const targetName = sections.find((s) => s.id === bulkTargetSectionId)?.name;
        const suiteLabel = suites.find((suite) => suite.id === sections.find((s) => s.id === bulkTargetSectionId)?.suiteId)?.name;
        const dest = suiteLabel && targetName ? `${suiteLabel} / ${targetName}` : targetName ?? "target section";
        setBulkSuccess(`${count} case${count !== 1 ? "s" : ""} ${bulkAction === "move" ? "moved" : "copied"} to ${dest}.`);
      }
      await loadOverview();
      loadSummary();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBulkWorking(false);
    }
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
                        <td className="px-5 py-3 text-right tabular-nums text-success">{sum != null ? sum.approved : "—"}</td>
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

  /** Recursive section tree node for the left panel */
  function SectionTreeNode({ section, depth }: { section: SectionNode; depth: number }) {
    const count = totalCaseCount(section);
    const isActive = selectedSectionId === section.id;
    const isEditing = editingSectionId === section.id;

    return (
      <div>
        <div
          data-testid={`section-node-${section.id}`}
          role="button"
          tabIndex={0}
          className={`group flex items-center gap-1 rounded px-2 py-1 cursor-pointer select-none transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-raised hover:text-text"}`}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => { setSelectedSectionId(section.id); setDetailPanelOpen(false); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedSectionId(section.id); setDetailPanelOpen(false); } }}
          aria-pressed={isActive}
          aria-label={`Section: ${section.name}${isActive ? " (selected)" : ""}`}
        >
          {isEditing ? (
            <form
              onSubmit={(e) => { e.preventDefault(); saveSectionName(section.id); }}
              className="flex flex-1 items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                value={editingSectionName}
                onChange={(e) => setEditingSectionName(e.target.value)}
                className="min-w-0 flex-1 rounded border border-border bg-surface-raised text-text px-1.5 py-0.5 text-xs focus:border-primary focus:outline-none"
                autoFocus
              />
              <button type="submit" disabled={saving} className="text-xs font-medium text-primary hover:underline">Save</button>
              <button type="button" className="text-xs text-muted hover:underline" onClick={() => { setEditingSectionId(null); setEditingSectionName(""); }}>✕</button>
            </form>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate text-xs">{section.name}</span>
              {count > 0 && (
                <span className={`shrink-0 text-xs tabular-nums ${isActive ? "text-primary/70" : "text-muted"}`}>{count}</span>
              )}
              <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => { setEditingSectionId(section.id); setEditingSectionName(section.name); }}
                  className="rounded p-0.5 text-muted hover:text-text"
                  aria-label="Rename"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSection(section)}
                  className="rounded p-0.5 text-muted hover:text-error"
                  aria-label="Delete"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => setAddingSubsectionUnder(section.id)}
                  className="rounded p-0.5 text-muted hover:text-text"
                  aria-label="Add subsection"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </>
          )}
        </div>
        {addingSubsectionUnder === section.id && (
          <form onSubmit={addSubSection} className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: 8 + (depth + 1) * 12 }}>
            <input
              value={newSubsectionName}
              onChange={(e) => setNewSubsectionName(e.target.value)}
              placeholder="Section name"
              className="min-w-0 flex-1 rounded border border-border bg-surface-raised text-text px-1.5 py-0.5 text-xs focus:border-primary focus:outline-none"
              autoFocus
            />
            <button type="submit" disabled={saving} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">Add</button>
            <button type="button" className="text-xs text-muted" onClick={() => { setAddingSubsectionUnder(null); setNewSubsectionName(""); }}>✕</button>
          </form>
        )}
        {section.children.map((ch) => (
          <SectionTreeNode key={ch.id} section={ch} depth={depth + 1} />
        ))}
      </div>
    );
  }

  // ── Project-scoped view: new mockup layout ─────────────────────────────────
  const suite = suites[0] ?? null;

  return (
    <div className="flex h-full overflow-hidden -m-4"> {/* cancel parent padding */}

      {/* ── Left: Suite tree panel ────────────────────────────────── */}
      <div data-testid="section-tree" className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface">

        {/* Header: project name + "all cases" link */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <button
            type="button"
            onClick={() => { setSelectedSectionId(null); setDetailPanelOpen(false); }}
            className={`text-xs font-semibold truncate ${!selectedSectionId ? "text-primary" : "text-muted hover:text-text"}`}
          >
            {currentProject.name}
          </button>
          <button
            type="button"
            onClick={() => setProjectId(null)}
            className="text-muted hover:text-text"
            title="View all projects"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
        </div>

        {/* Suite tree */}
        {overviewLoading ? (
          <div className="p-3"><LoadingSpinner /></div>
        ) : suites.length === 0 ? (
          <div className="p-3 text-xs text-muted">No suites yet.</div>
        ) : (
          <div className="flex-1 overflow-y-auto py-1">
            {suites.map((suiteItem) => {
              const suiteSections = sortedTree.filter((s) => s.suiteId === suiteItem.id);
              const suiteCaseCount = suiteSections.reduce((n, s) => n + totalCaseCount(s), 0);
              return (
                <div key={suiteItem.id} className="mb-3">
                  {/* Suite heading */}
                  <div className="flex items-center justify-between px-3 py-1">
                    <span
                      className="italic text-sm text-muted"
                      style={{ fontFamily: "var(--font-serif)" }}
                      title={suiteItem.name}
                    >
                      {suiteItem.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs tabular-nums text-muted">{suiteCaseCount}</span>
                      <button
                        type="button"
                        onClick={() => setAddSectionSuiteId(addSectionSuiteId === suiteItem.id ? null : suiteItem.id)}
                        className="rounded p-0.5 text-muted hover:text-text"
                        title="Add section"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </button>
                    </div>
                  </div>
                  {addSectionSuiteId === suiteItem.id && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!(newSectionName[suiteItem.id] ?? "").trim()) return;
                        setSaving(true);
                        try {
                          await api(`/api/suites/${suiteItem.id}/sections`, { method: "POST", body: JSON.stringify({ name: (newSectionName[suiteItem.id] ?? "").trim() }) });
                          setNewSectionName((prev) => ({ ...prev, [suiteItem.id]: "" }));
                          setAddSectionSuiteId(null);
                          loadOverview();
                        } catch { /* ignore */ } finally { setSaving(false); }
                      }}
                      className="flex items-center gap-1 px-3 py-1"
                    >
                      <input
                        value={newSectionName[suiteItem.id] ?? ""}
                        onChange={(e) => setNewSectionName((prev) => ({ ...prev, [suiteItem.id]: e.target.value }))}
                        placeholder="Section name"
                        className="min-w-0 flex-1 rounded border border-border bg-surface-raised text-text px-1.5 py-0.5 text-xs focus:border-primary focus:outline-none"
                        autoFocus
                      />
                      <button type="submit" disabled={saving} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">Add</button>
                      <button type="button" className="text-xs text-muted" onClick={() => { setAddSectionSuiteId(null); setNewSectionName((prev) => ({ ...prev, [suiteItem.id]: "" })); }}>✕</button>
                    </form>
                  )}
                  {/* Sections tree */}
                  {suiteSections.map((s) => (
                    <SectionTreeNode key={s.id} section={s} depth={0} />
                  ))}
                  {suiteSections.length === 0 && (
                    <div className="px-3 py-1 text-xs text-muted/60 italic">No sections</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: table + detail panel ───────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Breadcrumb + actions bar */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted font-mono">
            {selectedSuite && (
              <>
                <span className="text-text">{selectedSuite.name}</span>
                <span>›</span>
              </>
            )}
            {selectedSection ? (
              <span className="text-text">{selectedSection.name}</span>
            ) : (
              <span>All cases</span>
            )}
            <span className="ml-1 text-muted">— {visibleCases.length} case{visibleCases.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            {suite && (
              <Link
                to={`/sections/${selectedSectionId ?? ""}/cases/new`}
                className={`rounded border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-muted no-underline shadow-sm transition hover:bg-primary hover:text-white hover:border-primary ${!selectedSectionId ? "pointer-events-none opacity-50" : ""}`}
              >
                + Add Case
              </Link>
            )}
          </div>
        </div>

        {/* Filter toolbar */}
        <div className="flex flex-nowrap items-center gap-2 border-b border-border px-4 py-2 bg-surface/50 overflow-x-auto">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search test cases…"
            className="h-7 w-44 shrink-0 rounded border border-border bg-surface-raised text-text px-2.5 text-xs placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="h-7 shrink-0 rounded border border-border bg-surface-raised text-text px-2 text-xs cursor-pointer appearance-none focus:border-primary focus:outline-none" style={{ colorScheme: "dark" }}>
            <option value="">All priorities</option>
            {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter((e.target.value || "") as "" | "draft" | "ready" | "approved")} className="h-7 shrink-0 rounded border border-border bg-surface-raised text-text px-2 text-xs cursor-pointer appearance-none focus:border-primary focus:outline-none" style={{ colorScheme: "dark" }}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="approved">Approved</option>
          </select>
          <select value={caseTypeFilter} onChange={(e) => setCaseTypeFilter(e.target.value)} className="h-7 shrink-0 rounded border border-border bg-surface-raised text-text px-2 text-xs cursor-pointer appearance-none focus:border-primary focus:outline-none" style={{ colorScheme: "dark" }}>
            <option value="">All types</option>
            {caseTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="h-7 shrink-0 rounded border border-border bg-surface-raised text-text px-2 text-xs cursor-pointer appearance-none focus:border-primary focus:outline-none" style={{ colorScheme: "dark" }}>
            <option value="section">Sort: Section</option>
            <option value="title-asc">Sort: Title A–Z</option>
            <option value="title-desc">Sort: Title Z–A</option>
            <option value="status">Sort: Status</option>
            <option value="priority">Sort: Priority</option>
          </select>
          {(priorityFilter || statusFilter || caseTypeFilter || searchQuery) && (
            <button
              type="button"
              onClick={() => { setPriorityFilter(""); setStatusFilter(""); setCaseTypeFilter(""); setSearchQuery(""); }}
              className="text-xs text-muted hover:text-error"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Bulk action bar */}
        {selectedCaseIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-primary/30 bg-primary/5 px-4 py-2">
            <span className="text-xs font-medium text-text">{selectedCaseIds.size} selected</span>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value as BulkAction)} className="h-6 rounded border border-border bg-surface-raised text-text px-2 text-xs focus:border-primary focus:outline-none">
              <option value="move">Move to</option>
              <option value="copy">Copy to</option>
              <option value="delete">Delete</option>
            </select>
            {(bulkAction === "move" || bulkAction === "copy") && (
              <select value={bulkTargetSectionId} onChange={(e) => setBulkTargetSectionId(e.target.value)} className="h-6 rounded border border-border bg-surface-raised text-text px-2 text-xs focus:border-primary focus:outline-none">
                <option value="">Target section…</option>
                {sections.map((s) => { const sn = suites.find((su) => su.id === s.suiteId)?.name; return <option key={s.id} value={s.id}>{sn ? `${sn} / ${s.name}` : s.name}</option>; })}
              </select>
            )}
            <button type="button" onClick={handleBulkSubmit} disabled={bulkWorking} className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-white transition hover:bg-primary-hover disabled:opacity-50">{bulkWorking ? "Working…" : "Apply"}</button>
            <button type="button" onClick={() => { setSelectedCaseIds(new Set()); setBulkError(""); setBulkSuccess(""); }} className="text-xs text-muted hover:underline">Clear</button>
            {bulkError && <span className="text-xs text-error">{bulkError}</span>}
            {bulkSuccess && <span className="text-xs text-primary">{bulkSuccess}</span>}
          </div>
        )}

        {overviewError && (
          <div className="border-b border-error/30 bg-error/10 px-4 py-2 text-xs text-error">{overviewError}</div>
        )}

        {/* Case table */}
        <div className="flex-1 overflow-auto">
          {overviewLoading ? (
            <div className="flex items-center justify-center py-12"><LoadingSpinner /></div>
          ) : suites.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <EmptyState message="No test suite yet." action={<Link to={`/projects/${projectId}`} className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover">Go to project</Link>} />
            </div>
          ) : !selectedSectionId ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted">Select a section in the tree to view its test cases.</p>
            </div>
          ) : visibleCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted">No cases in this section.</p>
              {selectedSectionId && (
                <Link to={`/sections/${selectedSectionId}/cases/new`} className="mt-2 inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-primary-hover">+ Add case</Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm" style={{ tableLayout: "fixed" }}>
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border">
                  <th className="w-8 px-2 py-2" aria-label="Select">
                    <input
                      type="checkbox"
                      checked={visibleCases.length > 0 && visibleCases.every((c) => selectedCaseIds.has(c.id))}
                      ref={(el) => { if (el) el.indeterminate = selectedCaseIds.size > 0 && !visibleCases.every((c) => selectedCaseIds.has(c.id)); }}
                      onChange={() => {
                        const allSelected = visibleCases.every((c) => selectedCaseIds.has(c.id));
                        setSelectedCaseIds((prev) => {
                          const next = new Set(prev);
                          visibleCases.forEach((c) => allSelected ? next.delete(c.id) : next.add(c.id));
                          return next;
                        });
                      }}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                  </th>
                  <th className="w-20 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">ID</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">Title</th>
                  <th className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">Priority</th>
                  <th className="w-28 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">Type</th>
                  <th className="w-16 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted">Status</th>
                  <th className="w-20 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCases.map((c) => {
                  const displayId = caseDisplayIds.get(c.id) ?? "—";
                  const caseType = caseTypes.find((t) => t.id === c.caseTypeId);
                  const isSelected = selectedCaseIds.has(c.id);
                  const isDetailOpen = detailPanelOpen && selectedCaseId === c.id;
                  return (
                    <tr
                      key={c.id}
                      data-testid={`case-row-${c.id}`}
                      tabIndex={0}
                      role="button"
                      aria-label={`Case: ${c.title}`}
                      className={`border-b border-border cursor-pointer transition-colors ${isDetailOpen ? "bg-primary/5" : isSelected ? "bg-primary/5" : "hover:bg-surface-raised/60"}`}
                      style={{ height: 32 }}
                      onClick={() => { setSelectedCaseId(c.id); setDetailPanelOpen(true); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedCaseId(c.id); setDetailPanelOpen(true); } }}
                    >
                      <td className="px-2 py-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => setSelectedCaseIds((prev) => { const next = new Set(prev); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next; })}
                          className="h-3.5 w-3.5 rounded border-border accent-primary"
                        />
                      </td>
                      <td className="px-3 py-0 font-mono text-xs text-muted">{displayId}</td>
                      <td className="px-3 py-0 text-xs text-text truncate max-w-0">
                        <span className="block truncate" title={c.title}>{c.title || "(Untitled)"}</span>
                      </td>
                      <td className="px-3 py-0"><PriorityBadge priorityId={c.priorityId} priorities={priorities} /></td>
                      <td className="px-3 py-0 text-xs text-muted truncate">{caseType?.name ?? "—"}</td>
                      <td className="px-3 py-0">
                        <StatusDot status={c.status} />
                      </td>
                      <td className="px-3 py-0 text-right" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/cases/${c.id}/edit`} className="text-xs text-muted no-underline hover:text-primary mr-2">Edit</Link>
                        <button type="button" onClick={() => handleDuplicateCase(c)} disabled={saving} className="text-xs text-muted hover:text-primary disabled:opacity-50 mr-2">Dup</button>
                        <button type="button" onClick={() => handleDeleteCase(c)} disabled={saving} className="text-xs text-muted hover:text-error disabled:opacity-50">Del</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Status bar */}
        {selectedSectionId && visibleCases.length > 0 && (
          <div className="flex items-center gap-4 border-t border-border bg-surface px-4 py-1.5">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <StatusDot status="approved" />{statusCounts.approved} approved
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <StatusDot status="ready" />{statusCounts.ready} ready
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <StatusDot status="draft" />{statusCounts.draft} draft
            </span>
            {statusCounts.none > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <StatusDot />{statusCounts.none} unset
              </span>
            )}
            <span className="ml-auto text-xs tabular-nums text-muted">{visibleCases.length} total</span>
          </div>
        )}
      </div>

      {/* ── Detail panel (slide-in from right) ───────────────────── */}
      <div
        data-testid="detail-panel"
        className={`fixed right-0 top-12 z-40 flex h-[calc(100vh-3rem)] w-96 flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-200 ${detailPanelOpen && selectedCase ? "translate-x-0" : "translate-x-full"}`}
        aria-label="Case detail panel"
      >
        {selectedCase && (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-mono text-xs text-muted">{caseDisplayIds.get(selectedCase.id) ?? "—"}</span>
              <button
                type="button"
                onClick={() => setDetailPanelOpen(false)}
                className="rounded p-1 text-muted hover:bg-surface-raised hover:text-text"
                aria-label="Close panel"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <h2 className="mb-4 text-base font-semibold text-text leading-snug">{selectedCase.title || "(Untitled)"}</h2>

              <div className="mb-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Properties</p>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <span className="text-muted">Status</span>
                  <span className="flex items-center gap-1.5"><StatusDot status={selectedCase.status} /><span className="text-text capitalize">{selectedCase.status ?? "—"}</span></span>
                  <span className="text-muted">Priority</span>
                  <PriorityBadge priorityId={selectedCase.priorityId} priorities={priorities} />
                  <span className="text-muted">Type</span>
                  <span className="text-text">{caseTypes.find((t) => t.id === selectedCase.caseTypeId)?.name ?? "—"}</span>
                </div>
              </div>

              {selectedCase.prerequisite && (
                <div className="mb-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Prerequisite</p>
                  <p className="text-xs text-muted">{selectedCase.prerequisite}</p>
                </div>
              )}

              {selectedCase.steps && selectedCase.steps.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Test Steps</p>
                  <ol className="space-y-2">
                    {selectedCase.steps.map((step, i) => (
                      <li key={step.id ?? i} className="flex gap-2.5">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-surface-raised font-mono text-xs text-muted">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs text-text">{step.content}</p>
                          {step.expected && <p className="mt-0.5 text-xs text-muted">{step.expected}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            <div className="border-t border-border p-4">
              <Link
                to={`/cases/${selectedCase.id}/edit`}
                className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white no-underline shadow-sm transition hover:bg-primary-hover"
              >
                Edit case
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
