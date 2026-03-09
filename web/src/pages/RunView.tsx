import { useEffect, useState, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { api, type Run, type RunTest, type RunActivityEntry } from "../api";
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

const STATUSES = ["passed", "failed", "blocked", "skipped", "untested"] as const;

function statusBadgeClass(s: string): string {
  switch (s) {
    case "passed": return "bg-success/10 text-success";
    case "failed": return "bg-error/10 text-error";
    case "blocked": return "bg-warning/10 text-warning";
    case "skipped": return "bg-gray-100 text-gray-600";
    default: return "bg-gray-100 text-muted";
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
  const tab = runId ? getRunTab(location.pathname) : "tests";
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [sortBy, setSortBy] = useState<string>("section");
  const [activityList, setActivityList] = useState<RunActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

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
    if (tab !== "activity" || !runId) return;
    setActivityLoading(true);
    setActivityError("");
    api<{ activity: RunActivityEntry[] }>(`/api/runs/${runId}/activity`)
      .then((res) => {
        setActivityList(res.activity);
      })
      .catch((err) => {
        setActivityError(err instanceof Error ? err.message : "Failed to load activity");
        setActivityList([]);
      })
      .finally(() => setActivityLoading(false));
  }, [runId, tab]);

  const testsForSections = run?.tests ?? [];
  const sections = useMemo(() => groupTestsBySection(testsForSections), [testsForSections]);
  /** Flat list in display order (for Pass & Next in sidebar) */
  const allTestsInOrder = useMemo(
    () => sections.flatMap((s) => s.tests),
    [sections]
  );
  const selectedTest = selectedTestId ? allTestsInOrder.find((t) => t.id === selectedTestId) : null;
  const activityByDate = useMemo(() => {
    const byDate = new Map<string, RunActivityEntry[]>();
    for (const entry of activityList) {
      const key = entry.createdAt.slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(entry);
    }
    return [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [activityList]);

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
  const tests = run.tests ?? [];
  const total = summary.passed + summary.failed + summary.blocked + summary.skipped + summary.untested;
  const passPct = total > 0 ? Math.round((summary.passed / total) * 100) : 0;
  const runBadgeId = run.id.slice(0, 8).toUpperCase();

  // Tab content: Activity (full implementation), Progress/Defects stubs
  if (tab === "activity") {
    const summaryForActivity = run.summary ?? { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: 0 };
    const totalForActivity =
      summaryForActivity.passed +
      summaryForActivity.failed +
      summaryForActivity.blocked +
      summaryForActivity.skipped +
      summaryForActivity.untested;
    return (
      <div className="max-w-4xl">
        <RunTitle runName={run.name} badgeId={runBadgeId} />
        {/* Summary strip */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
          <span className="font-medium text-success">{summaryForActivity.passed} Passed</span>
          <span className="font-medium text-error">{summaryForActivity.failed} Failed</span>
          <span>{summaryForActivity.blocked} Blocked</span>
          <span>{summaryForActivity.skipped} Skipped</span>
          {totalForActivity > 0 && (
            <span>
              {summaryForActivity.untested} Untested (
              {Math.round((summaryForActivity.untested / totalForActivity) * 100)}%)
            </span>
          )}
        </div>
        <h2 className="mt-6 border-b border-border pb-2 text-lg font-semibold text-gray-900">Activity</h2>
        {activityLoading && <LoadingSpinner />}
        {activityError && <p className="mt-4 text-error">{activityError}</p>}
        {!activityLoading && !activityError && activityList.length === 0 && (
          <p className="mt-4 text-muted">No activity yet.</p>
        )}
        {!activityLoading && !activityError && activityByDate.length > 0 && (
          <ul className="mt-4 list-none p-0" role="list">
            {activityByDate.map(([dateKey, entries]) => (
              <li key={dateKey} className="mb-6">
                <h3 className="mb-3 text-sm font-medium text-muted">
                  {new Date(dateKey + "T12:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
                <Card className="overflow-hidden p-0">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 last:border-b-0"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          className={cn(
                            "shrink-0 rounded px-2 py-0.5 text-xs font-medium capitalize",
                            entry.type === "comment"
                              ? "bg-gray-100 text-gray-600"
                              : statusBadgeClass(entry.status ?? "untested")
                          )}
                        >
                          {entry.type === "comment" ? "Comment" : entry.status}
                        </span>
                        <span className="min-w-0 truncate font-medium text-gray-900">{entry.caseTitle || "(No title)"}</span>
                      </div>
                      <span className="shrink-0 text-sm text-muted">
                        {entry.type === "result" ? "Tested by" : "Added by"} {entry.createdByName}
                      </span>
                    </div>
                  ))}
                </Card>
              </li>
            ))}
          </ul>
        )}
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
          <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="flex h-full">
              {summary.passed > 0 && <div className="bg-success" style={{ width: `${total > 0 ? (summary.passed / total) * 100 : 0}%` }} />}
              {summary.failed > 0 && <div className="bg-error" style={{ width: `${total > 0 ? (summary.failed / total) * 100 : 0}%` }} />}
              {summary.blocked > 0 && <div className="bg-warning" style={{ width: `${total > 0 ? (summary.blocked / total) * 100 : 0}%` }} />}
              {summary.skipped > 0 && <div className="bg-gray-400" style={{ width: `${total > 0 ? (summary.skipped / total) * 100 : 0}%` }} />}
              {summary.untested > 0 && <div className="bg-gray-200" style={{ width: `${total > 0 ? (summary.untested / total) * 100 : 0}%` }} />}
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

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-40 text-sm">
          <option value="section">Sort: Section</option>
          <option value="status">Sort: Status</option>
        </Select>
        <label className="flex cursor-pointer items-center gap-2 rounded border border-border bg-surface px-3 py-1.5 text-sm hover:bg-gray-50">
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
        {importMessage && (
          <span className={cn("text-sm", importMessage.startsWith("Imported") ? "text-success" : "text-error")}>{importMessage}</span>
        )}
      </div>

      {/* Tests table + execution sidebar */}
      <div className="flex gap-0">
        <div className={cn("min-w-0 flex-1", selectedTest && "md:max-w-[calc(100%-380px)] lg:max-w-[calc(100%-420px)]")}>
          <Card className="overflow-hidden p-0">
            {sections.length === 0 ? (
              <p className="p-6 text-muted">No tests in this run.</p>
            ) : (
              sections.map(({ sectionName, tests: sectionTests }) => (
                <div key={sectionName} className="border-b border-border last:border-b-0">
                  <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-muted">{sectionName}</div>
                  <Table>
                    <TableHead>
                      <TableHeaderRow>
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
                              isSelected && "bg-primary/5"
                            )}
                          >
                            <TableCell className="font-mono text-xs text-muted">{t.id.slice(0, 8)}</TableCell>
                            <TableCell className="font-medium text-slate-900">
                              {t.caseTitle}
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
              projectId={run.projectId ?? undefined}
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
