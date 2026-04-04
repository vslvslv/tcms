import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { api, type Run, type RunTest, type FlakyTest, type BulkStatusResult } from "../api";
import { useProject } from "../ProjectContext";
import { FlakyBadge } from "../components/FlakyBadge";
import { RunTestCaseSidebar } from "../components/RunTestCaseSidebar";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageTitle } from "../components/ui/PageTitle";
import { Select } from "../components/ui/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderRow,
  TableHeadCell,
  TableRow,
} from "../components/ui/Table";
import { cn } from "../lib/cn";

function statusBadgeClass(s: string): string {
  switch (s) {
    case "passed": return "bg-success/10 text-success";
    case "failed": return "bg-error/10 text-error";
    case "blocked": return "bg-warning/10 text-warning";
    case "skipped": return "bg-surface-raised text-muted";
    default: return "bg-surface-raised text-muted";
  }
}

type TabKey = "tests" | "activity" | "progress" | "defects";

function getRunTab(path: string): TabKey {
  if (path.endsWith("/activity")) return "activity";
  if (path.endsWith("/progress")) return "progress";
  if (path.endsWith("/defects")) return "defects";
  return "tests";
}

/** Group tests by section name (empty string for no section) */
function groupTestsBySection(tests: RunTest[]): { sectionName: string; tests: RunTest[] }[] {
  const bySection = new Map<string, RunTest[]>();
  for (const t of tests) {
    const key = t.sectionName ?? "(No section)";
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(t);
  }
  return [...bySection.entries()].map(([sectionName, tests]) => ({ sectionName, tests }));
}

export default function RunView() {
  const { runId } = useParams<{ runId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId } = useProject();
  const tab = runId ? getRunTab(location.pathname) : "tests";
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [sortBy, setSortBy] = useState<string>("section");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [flakyMap, setFlakyMap] = useState<Map<string, number>>(new Map());
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("passed");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  function loadRun() {
    if (!runId) return;
    api<Run>(`/api/runs/${runId}`)
      .then(setRun)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRun();
  }, [runId]);

  useEffect(() => {
    const pid = run?.projectId ?? projectId;
    if (!pid) return;
    api<FlakyTest[]>(`/api/projects/${pid}/flaky-tests`)
      .then((data) => {
        const m = new Map<string, number>();
        for (const ft of data) m.set(ft.caseId, ft.flakinessScore);
        setFlakyMap(m);
      })
      .catch(() => { /* silent — badge hidden if unavailable */ });
  }, [run?.projectId, projectId]);

  const testsForSections = run?.tests ?? [];
  const filteredTests = useMemo(
    () => statusFilter === "all"
      ? testsForSections
      : testsForSections.filter((t) => (t.latestResult?.status ?? "untested") === statusFilter),
    [testsForSections, statusFilter]
  );
  const sections = useMemo(() => groupTestsBySection(filteredTests), [filteredTests]);
  /** Flat list in display order (for Pass & Next in sidebar) */
  const allTestsInOrder = useMemo(
    () => sections.flatMap((s) => s.tests),
    [sections]
  );
  const selectedTest = selectedTestId ? allTestsInOrder.find((t) => t.id === selectedTestId) : null;
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  // Keyboard shortcuts: j/k navigate, p/f/b/s set status, n next untested, ? help
  const setStatusViaShortcut = useCallback(async (testId: string, status: string) => {
    try {
      await api(`/api/tests/${testId}/results`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      loadRun();
    } catch { /* ignore shortcut errors */ }
  }, [runId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === "?") { setShowShortcutHelp((v) => !v); return; }

      const idx = selectedTestId ? allTestsInOrder.findIndex((t) => t.id === selectedTestId) : -1;

      if (key === "j") {
        e.preventDefault();
        const next = idx < allTestsInOrder.length - 1 ? idx + 1 : 0;
        setSelectedTestId(allTestsInOrder[next]?.id ?? null);
      } else if (key === "k") {
        e.preventDefault();
        const prev = idx > 0 ? idx - 1 : allTestsInOrder.length - 1;
        setSelectedTestId(allTestsInOrder[prev]?.id ?? null);
      } else if (key === "n") {
        e.preventDefault();
        const untested = allTestsInOrder.find((t) => !t.latestResult || t.latestResult.status === "untested");
        if (untested) setSelectedTestId(untested.id);
      } else if (selectedTestId && "pfbs".includes(key)) {
        e.preventDefault();
        const statusMap: Record<string, string> = { p: "passed", f: "failed", b: "blocked", s: "skipped" };
        setStatusViaShortcut(selectedTestId, statusMap[key]);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTestId, allTestsInOrder, setStatusViaShortcut]);

  async function applyBulkStatus() {
    if (!runId || selectedTestIds.size === 0) return;
    setBulkApplying(true);
    setBulkMessage(null);
    try {
      const res = await api<BulkStatusResult>(`/api/runs/${runId}/tests/bulk-status`, {
        method: "POST",
        body: JSON.stringify({ testIds: [...selectedTestIds], status: bulkStatus }),
      });
      setBulkMessage({ text: `Updated ${res.updated} test${res.updated !== 1 ? "s" : ""} to ${res.status}`, type: "success" });
      setSelectedTestIds(new Set());
      loadRun();
    } catch (err) {
      setBulkMessage({ text: err instanceof Error ? err.message : "Failed to update", type: "error" });
    } finally {
      setBulkApplying(false);
    }
  }

  async function importResults(file: File) {
    if (!runId) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const text = await file.text();
      const isXml = file.name.toLowerCase().endsWith(".xml") || file.type === "application/xml";
      const contentType = isXml ? "application/xml" : "application/json";
      const res = await api<{ imported: number; added: number; updated: number }>(`/api/runs/${runId}/import/results`, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: text,
      });
      setImportMessage(`Imported: ${res.imported} (${res.added} new tests, ${res.updated} results to existing)`);
      loadRun();
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleResultSubmitted(nextTestId?: string | null) {
    loadRun();
    if (nextTestId !== undefined) setSelectedTestId(nextTestId);
  }

  if (!runId) return null;
  if (loading) return <LoadingSpinner />;
  if (error && !run) return <p className="text-error">{error}</p>;
  if (!run) return null;

  const summary = run.summary ?? { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: 0 };
  const total = summary.passed + summary.failed + summary.blocked + summary.skipped + summary.untested;
  const passPct = total > 0 ? Math.round((summary.passed / total) * 100) : 0;
  const runBadgeId = run.id.slice(0, 8).toUpperCase();

  // Tab content: stubs for Activity, Progress, Defects
  if (tab === "activity") {
    return (
      <div>
        <RunTitle runName={run.name} badgeId={runBadgeId} />
        <Card className="mt-4 p-8 text-center text-muted">Activity for this run will be shown here (e.g. audit log).</Card>
      </div>
    );
  }
  if (tab === "progress") {
    return (
      <div>
        <RunTitle runName={run.name} badgeId={runBadgeId} />
        <Card className="mt-4 p-8 text-center text-muted">Progress over time will be shown here.</Card>
      </div>
    );
  }
  if (tab === "defects") {
    return (
      <div>
        <RunTitle runName={run.name} badgeId={runBadgeId} />
        <Card className="mt-4 p-8 text-center text-muted">Defects linked to this run will be listed here.</Card>
      </div>
    );
  }

  // Tests & Results tab (sections already computed above)
  return (
    <div className="max-w-6xl">
      <RunTitle runName={run.name} badgeId={runBadgeId} />

      {/* Summary widgets */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Test Status</h3>
          <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-surface-raised">
            <div className="flex h-full">
              {summary.passed > 0 && <div className="bg-success" style={{ width: `${total > 0 ? (summary.passed / total) * 100 : 0}%` }} />}
              {summary.failed > 0 && <div className="bg-error" style={{ width: `${total > 0 ? (summary.failed / total) * 100 : 0}%` }} />}
              {summary.blocked > 0 && <div className="bg-warning" style={{ width: `${total > 0 ? (summary.blocked / total) * 100 : 0}%` }} />}
              {summary.skipped > 0 && <div className="bg-muted" style={{ width: `${total > 0 ? (summary.skipped / total) * 100 : 0}%` }} />}
              {summary.untested > 0 && <div className="bg-surface-raised" style={{ width: `${total > 0 ? (summary.untested / total) * 100 : 0}%` }} />}
            </div>
          </div>
          <div className="text-sm">
            <div className="font-medium text-success">{summary.passed} Passed</div>
            <div className="text-muted">{summary.blocked} Blocked</div>
            <div className="text-muted">{summary.skipped} Skipped</div>
            <div className="font-medium text-error">{summary.failed} Failed</div>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Automation Status</h3>
          <div className="text-sm text-muted">0 Automation Passed · 0 Automation Failed · 0 Automation Error</div>
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Overall Pass Rate</h3>
          <div className="text-2xl font-semibold text-success">{passPct}% passed</div>
          <div className="text-sm text-muted">{summary.untested}/{total} untested ({total > 0 ? Math.round((summary.untested / total) * 100) : 0}%)</div>
        </Card>
      </div>

      {/* Toolbar / Bulk Status Bar */}
      {selectedTestIds.size > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded border border-border bg-surface-raised px-3 py-2">
          <span className="text-sm font-medium text-text">{selectedTestIds.size} selected</span>
          <span className="text-sm text-muted">Set status:</span>
          <Select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            aria-label={`Set status for ${selectedTestIds.size} selected tests`}
            className="w-32 text-sm"
            disabled={bulkApplying}
          >
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="blocked">Blocked</option>
            <option value="skipped">Skipped</option>
            <option value="untested">Untested</option>
          </Select>
          <Button variant="primary" onClick={applyBulkStatus} disabled={bulkApplying}>
            {bulkApplying ? "Applying…" : "Apply"}
          </Button>
          <button
            type="button"
            className="text-sm text-muted hover:text-text"
            onClick={() => { setSelectedTestIds(new Set()); setBulkMessage(null); }}
          >
            Deselect all
          </button>
          {bulkMessage && (
            <span className={cn("ml-auto text-sm", bulkMessage.type === "success" ? "text-success" : "text-error")}>
              {bulkMessage.text}
            </span>
          )}
        </div>
      ) : (
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-40 text-sm">
          <option value="section">Sort: Section</option>
          <option value="status">Sort: Status</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setSelectedTestId(null); setSelectedTestIds(new Set()); }}
          aria-label="Filter by status"
          className="w-36 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="blocked">Blocked</option>
          <option value="skipped">Skipped</option>
          <option value="untested">Untested</option>
        </Select>
        <label className="flex cursor-pointer items-center gap-2 rounded border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-raised">
          <span>+ Add Results</span>
          <input
            type="file"
            accept=".xml,.json,application/xml,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importResults(f);
              e.target.value = "";
            }}
            disabled={importing}
          />
        </label>
        {summary.failed > 0 && (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const newRun = await api<{ id: string }>(`/api/runs/${runId}/rerun-failures`, { method: "POST" });
                navigate(`/runs/${newRun.id}`);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Re-run failed");
              }
            }}
          >
            Re-run {summary.failed} failed
          </Button>
        )}
        {importMessage && (
          <span className={cn("text-sm", importMessage.startsWith("Imported") ? "text-success" : "text-error")}>{importMessage}</span>
        )}
        <button
          type="button"
          onClick={() => setShowShortcutHelp((v) => !v)}
          className="ml-auto rounded border border-border px-2 py-1 text-xs text-muted hover:bg-surface-raised"
          title="Keyboard shortcuts (?)"
        >
          ? Shortcuts
        </button>
      </div>
      )}

      {showShortcutHelp && (
        <Card className="mb-4 p-4 text-sm">
          <div className="mb-2 font-semibold">Keyboard Shortcuts</div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <div><kbd className="rounded border bg-surface-raised px-1.5 py-0.5 font-mono text-xs">j</kbd> Next test</div>
            <div><kbd className="rounded border bg-surface-raised px-1.5 py-0.5 font-mono text-xs">k</kbd> Previous test</div>
            <div><kbd className="rounded border bg-surface-raised px-1.5 py-0.5 font-mono text-xs">p</kbd> Mark passed</div>
            <div><kbd className="rounded border bg-surface-raised px-1.5 py-0.5 font-mono text-xs">f</kbd> Mark failed</div>
            <div><kbd className="rounded border bg-surface-raised px-1.5 py-0.5 font-mono text-xs">b</kbd> Mark blocked</div>
            <div><kbd className="rounded border bg-surface-raised px-1.5 py-0.5 font-mono text-xs">s</kbd> Mark skipped</div>
            <div><kbd className="rounded border bg-surface-raised px-1.5 py-0.5 font-mono text-xs">n</kbd> Next untested</div>
            <div><kbd className="rounded border bg-surface-raised px-1.5 py-0.5 font-mono text-xs">?</kbd> Toggle this help</div>
          </div>
        </Card>
      )}

      {/* Tests table + execution sidebar */}
      <div className="flex gap-0">
        <div className={cn("min-w-0 flex-1", selectedTest && "md:max-w-[calc(100%-380px)] lg:max-w-[calc(100%-420px)]")}>
          <Card className="overflow-hidden p-0">
            {sections.length === 0 ? (
              <p className="p-6 text-muted">
                {statusFilter !== "all"
                  ? (<>No {statusFilter} tests in this run. <button type="button" className="text-primary hover:underline" onClick={() => setStatusFilter("all")}>Clear filter</button></>)
                  : "No tests in this run."}
              </p>
            ) : (
              sections.map(({ sectionName, tests: sectionTests }) => (
                <div key={sectionName} className="border-b border-border last:border-b-0">
                  <div className="bg-surface-raised px-4 py-2 text-sm font-medium text-muted">{sectionName}</div>
                  <Table>
                    <TableHead>
                      <TableHeaderRow>
                        <TableHeadCell className="w-8">
                          <input
                            type="checkbox"
                            aria-label="Select all tests in section"
                            checked={sectionTests.every((t) => selectedTestIds.has(t.id))}
                            onChange={(e) => {
                              setSelectedTestIds((prev) => {
                                const next = new Set(prev);
                                for (const t of sectionTests) {
                                  if (e.target.checked) next.add(t.id);
                                  else next.delete(t.id);
                                }
                                return next;
                              });
                            }}
                          />
                        </TableHeadCell>
                        <TableHeadCell>ID</TableHeadCell>
                        <TableHeadCell>Title</TableHeadCell>
                        <TableHeadCell>Test Labels</TableHeadCell>
                        <TableHeadCell>Assigned To</TableHeadCell>
                        <TableHeadCell>Status</TableHeadCell>
                        <TableHeadCell className="w-8" />
                      </TableHeaderRow>
                    </TableHead>
                    <TableBody>
                      {sectionTests.map((t) => {
                        const status = t.latestResult?.status ?? "untested";
                        const isSelected = selectedTestId === t.id;
                        const isChecked = selectedTestIds.has(t.id);
                        return (
                          <TableRow
                            key={t.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedTestId(isSelected ? null : t.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedTestId(isSelected ? null : t.id);
                              }
                            }}
                            className={cn(
                              "cursor-pointer",
                              isSelected && "bg-primary/5",
                              isChecked && "bg-warning/5"
                            )}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                aria-label={`Select test: ${t.caseTitle}`}
                                checked={isChecked}
                                onChange={(e) => {
                                  setSelectedTestIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(t.id);
                                    else next.delete(t.id);
                                    return next;
                                  });
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted">{t.id.slice(0, 8)}</TableCell>
                            <TableCell className="font-medium text-text">
                              {t.caseTitle}
                              <FlakyBadge score={flakyMap.get(t.testCaseId ?? "") ?? 0} />
                              {t.datasetRow && Object.keys(t.datasetRow).length > 0 && (
                                <span className="ml-1 text-muted">— {Object.entries(t.datasetRow).map(([k, v]) => `${k}: ${v}`).join(", ")}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted">—</TableCell>
                            <TableCell className="text-muted">—</TableCell>
                            <TableCell>
                              <span className={cn("inline-flex rounded px-2 py-0.5 text-xs font-medium", statusBadgeClass(status))}>{status}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-muted">›</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))
            )}
          </Card>
        </div>
        {selectedTest && runId && (
          <div className="hidden w-full shrink-0 self-start md:block md:w-[380px] lg:w-[420px] md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:h-[calc(100vh-2rem)]">
            <RunTestCaseSidebar
              test={selectedTest}
              runId={runId}
              allTestsInOrder={allTestsInOrder}
              onClose={() => setSelectedTestId(null)}
              onResultSubmitted={handleResultSubmitted}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RunTitle({ runName, badgeId }: { runName: string; badgeId: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="inline-flex rounded bg-primary/10 px-2 py-0.5 font-mono text-sm font-medium text-primary">{badgeId}</span>
      <PageTitle className="mb-0">{runName}</PageTitle>
    </div>
  );
}
