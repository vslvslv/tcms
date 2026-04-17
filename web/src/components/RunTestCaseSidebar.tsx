import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type RunTest,
  type TestCase,
  type TestStep,
  type TestResult,
  type IssueLink,
  type CaseVersion,
  type ProjectMember,
} from "../api";
import { Button } from "./ui/Button";

import { LoadingSpinner } from "./ui/LoadingSpinner";
import { AttachmentPanel } from "./AttachmentPanel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderRow,
  TableHeadCell,
  TableRow,
} from "./ui/Table";
import { cn } from "../lib/cn";

const STATUSES = ["passed", "failed", "blocked", "skipped", "untested"] as const;

function statusBadgeClass(s: string): string {
  switch (s) {
    case "passed": return "bg-success/20 text-success";
    case "failed": return "bg-error/20 text-error";
    case "blocked": return "bg-warning/20 text-warning";
    case "skipped": return "bg-surface-raised text-muted";
    default: return "bg-surface-raised text-muted";
  }
}

function statusDotClass(s: string): string {
  switch (s) {
    case "passed": return "bg-success";
    case "failed": return "bg-error";
    case "blocked": return "bg-warning";
    case "skipped": return "bg-muted";
    default: return "bg-surface-raised";
  }
}

export type RunTestCaseSidebarProps = {
  test: RunTest;
  runId: string;
  projectId: string;
  /** Flat list of tests in display order (for Pass & Next) */
  allTestsInOrder: RunTest[];
  onClose: () => void;
  onResultSubmitted: (nextTestId?: string | null) => void;
};

type TabKey = "results" | "history" | "defects";

export function RunTestCaseSidebar({
  test,
  runId: _runId, // eslint-disable-line @typescript-eslint/no-unused-vars
  projectId,
  allTestsInOrder,
  onClose,
  onResultSubmitted,
}: RunTestCaseSidebarProps) {
  const [caseData, setCaseData] = useState<TestCase & { steps?: TestStep[] } | null>(null);
  const [caseLoading, setCaseLoading] = useState(true);
  const [resultHistory, setResultHistory] = useState<TestResult[]>([]);
  const latestResultId = resultHistory[0]?.id ?? null;
  const [resultStatus, setResultStatus] = useState<string>(test.latestResult?.status ?? "passed");
  const [resultComment, setResultComment] = useState("");
  const [resultElapsed, setResultElapsed] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("results");
  const [error, setError] = useState("");
  const [resultIssueLinks, setResultIssueLinks] = useState<IssueLink[]>([]);
  const [newIssueUrl, setNewIssueUrl] = useState("");
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [caseVersions, setCaseVersions] = useState<CaseVersion[]>([]);
  const [caseVersionsLoading, setCaseVersionsLoading] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [assigneeId, setAssigneeId] = useState<string | null>(test.assigneeId ?? null);
  const [assigneeWorking, setAssigneeWorking] = useState(false);

  const selectedResultId = test.latestResult?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    setCaseLoading(true);
    api<TestCase & { steps?: TestStep[] }>(`/api/cases/${test.testCaseId}`)
      .then((c) => {
        if (!cancelled) setCaseData(c);
      })
      .catch(() => {
        if (!cancelled) setCaseData(null);
      })
      .finally(() => {
        if (!cancelled) setCaseLoading(false);
      });
    return () => { cancelled = true; };
  }, [test.testCaseId]);

  useEffect(() => {
    api<TestResult[]>(`/api/tests/${test.id}/results`)
      .then(setResultHistory)
      .catch(() => setResultHistory([]));
  }, [test.id]);

  useEffect(() => {
    let cancelled = false;
    setCaseVersionsLoading(true);
    api<CaseVersion[]>(`/api/cases/${test.testCaseId}/versions`)
      .then((list) => {
        if (!cancelled) setCaseVersions(list);
      })
      .catch(() => {
        if (!cancelled) setCaseVersions([]);
      })
      .finally(() => {
        if (!cancelled) setCaseVersionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [test.testCaseId]);

  useEffect(() => {
    setResultStatus(test.latestResult?.status ?? "passed");
    setResultComment(test.latestResult?.comment ?? "");
    setResultElapsed(test.latestResult?.elapsedSeconds != null ? String(test.latestResult.elapsedSeconds) : "");
    setAssigneeId(test.assigneeId ?? null);
  }, [test.id, test.latestResult, test.assigneeId]);

  useEffect(() => {
    api<ProjectMember[]>(`/api/projects/${projectId}/members`)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [projectId]);

  useEffect(() => {
    if (!selectedResultId) {
      setResultIssueLinks([]);
      return;
    }
    api<IssueLink[]>(`/api/results/${selectedResultId}/issue-links`)
      .then(setResultIssueLinks)
      .catch(() => setResultIssueLinks([]));
  }, [selectedResultId]);

  async function handleAssigneeChange(newAssigneeId: string | null) {
    setAssigneeWorking(true);
    try {
      await api(`/api/tests/${test.id}`, {
        method: "PATCH",
        body: JSON.stringify({ assigneeId: newAssigneeId }),
      });
      setAssigneeId(newAssigneeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setAssigneeWorking(false);
    }
  }

  async function submitResult(statusOverride?: string, andSelectNext?: boolean) {
    setError("");
    setSubmitting(true);
    try {
      await api(`/api/tests/${test.id}/results`, {
        method: "POST",
        body: JSON.stringify({
          status: statusOverride ?? resultStatus,
          comment: resultComment || undefined,
          elapsedSeconds: resultElapsed ? parseInt(resultElapsed, 10) : undefined,
        }),
      });
      const idx = allTestsInOrder.findIndex((t) => t.id === test.id);
      const nextTest = idx >= 0 && idx < allTestsInOrder.length - 1 ? allTestsInOrder[idx + 1] : null;
      onResultSubmitted(andSelectNext ? nextTest?.id ?? null : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save result");
    } finally {
      setSubmitting(false);
    }
  }

  async function addResultIssueLink(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedResultId || !newIssueUrl.trim()) return;
    try {
      await api(`/api/results/${selectedResultId}/issue-links`, {
        method: "POST",
        body: JSON.stringify({ url: newIssueUrl.trim(), title: newIssueTitle.trim() || undefined }),
      });
      setNewIssueUrl("");
      setNewIssueTitle("");
      const list = await api<IssueLink[]>(`/api/results/${selectedResultId}/issue-links`);
      setResultIssueLinks(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add link");
    }
  }

  async function removeResultIssueLink(linkId: string) {
    try {
      await api(`/api/issue-links/${linkId}`, { method: "DELETE" });
      if (selectedResultId) {
        const list = await api<IssueLink[]>(`/api/results/${selectedResultId}/issue-links`);
        setResultIssueLinks(list);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove link");
    }
  }

  const steps = caseData?.steps ?? [];
  const status = test.latestResult?.status ?? "untested";
  const caseIdShort = test.testCaseId.slice(0, 8).toUpperCase();

  return (
    <div className="flex h-full flex-col border-l border-border bg-surface shadow-lg">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface-raised/40 px-4 py-3">
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", statusDotClass(status))} aria-hidden />
          <span className="inline-flex shrink-0 rounded bg-violet-100 px-2 py-0.5 font-mono text-xs font-medium text-violet-800">
            {caseIdShort}
          </span>
          <span className="truncate text-sm font-medium text-text">{test.caseTitle}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            to={`/cases/${test.testCaseId}/edit`}
            className="inline-flex items-center gap-1 rounded border border-border bg-surface-raised px-2 py-1.5 text-xs font-medium text-muted hover:bg-surface-raised"
          >
            <span aria-hidden>✎</span> Edit
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-muted hover:bg-surface-raised hover:text-text"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {caseLoading ? (
          <div className="flex items-center justify-center p-8">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* Preconditions & Steps */}
            <div className="border-b border-border p-4">
              {caseData?.prerequisite && (
                <div className="mb-4">
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Preconditions</h4>
                  <div className="whitespace-pre-wrap text-sm text-muted">{caseData.prerequisite}</div>
                </div>
              )}
              {steps.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Steps</h4>
                  <div className="space-y-3">
                    {steps.map((step, i) => (
                      <div key={step.id} className="rounded-lg border border-border bg-surface-raised/40 p-2.5">
                        <div className="mb-1 text-xs font-medium text-muted">Step {i + 1}</div>
                        <div className="text-sm text-text">{step.content}</div>
                        {step.expected && (
                          <div className="mt-1 text-xs text-muted">Expected: {step.expected}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!caseData?.prerequisite && steps.length === 0 && (
                <p className="text-sm text-muted">No preconditions or steps defined.</p>
              )}
            </div>

            {/* Tabs */}
            <div className="border-b border-border">
              <div className="flex gap-0">
                {(["results", "history", "defects"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-4 py-2.5 text-xs font-medium",
                      activeTab === tab
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted hover:text-text"
                    )}
                  >
                    {tab === "results" && "Results & Comments"}
                    {tab === "history" && "History & Context"}
                    {tab === "defects" && "Defects"}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4">
              {activeTab === "results" && (
                <>
                  {error && <p className="mb-2 text-sm text-error">{error}</p>}
                  <div className="mb-4">
                    <label className="mb-1 block text-xs font-medium text-muted">Comment</label>
                    <textarea
                      value={resultComment}
                      onChange={(e) => setResultComment(e.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Add a comment for this result…"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="mb-1 block text-xs font-medium text-muted">Status</label>
                    <select
                      value={resultStatus}
                      onChange={(e) => setResultStatus(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="mb-1 block text-xs font-medium text-muted">Elapsed (seconds)</label>
                    <input
                      type="number"
                      min={0}
                      value={resultElapsed}
                      onChange={(e) => setResultElapsed(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <h4 className="mb-2 text-xs font-semibold text-muted">Result history</h4>
                  <ul className="mb-4 list-none space-y-2 p-0">
                    {resultHistory.slice(0, 10).map((r) => (
                      <li key={r.id} className="flex flex-wrap items-start gap-2 rounded border border-border bg-surface-raised/40 p-2 text-xs">
                        <span className={cn("inline-flex rounded px-1.5 py-0.5 font-medium", statusBadgeClass(r.status))}>
                          {r.status}
                        </span>
                        <span className="text-muted">
                          {new Date(r.createdAt).toLocaleString()} · {r.createdBy.slice(0, 8)}
                        </span>
                        {r.comment && <span className="w-full text-muted">{r.comment}</span>}
                      </li>
                    ))}
                    {resultHistory.length === 0 && (
                      <li className="text-muted">No results yet for this test.</li>
                    )}
                  </ul>
                </>
              )}
              {activeTab === "history" && (
                <div className="space-y-2">
                  {caseVersionsLoading ? (
                    <div className="flex justify-center py-4">
                      <LoadingSpinner />
                    </div>
                  ) : caseVersions.length === 0 ? (
                    <p className="text-sm text-muted">No version history for this case yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <Table>
                        <TableHead>
                          <TableHeaderRow>
                            <TableHeadCell className="text-xs">Version</TableHeadCell>
                            <TableHeadCell className="text-xs">Date</TableHeadCell>
                            <TableHeadCell className="text-xs">Created by</TableHeadCell>
                            <TableHeadCell className="text-xs">Title</TableHeadCell>
                          </TableHeaderRow>
                        </TableHead>
                        <TableBody>
                          {caseVersions.map((v) => (
                            <TableRow key={v.id}>
                              <TableCell className="font-mono text-xs text-muted">{v.id.slice(0, 8)}</TableCell>
                              <TableCell className="text-xs text-text">
                                {new Date(v.createdAt).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-xs text-muted">{v.createdBy.slice(0, 8)}</TableCell>
                              <TableCell className="max-w-[120px] truncate text-xs text-text" title={v.title}>
                                {v.title}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "defects" && (
                <>
                  <ul className="mb-3 list-none space-y-1.5 p-0">
                    {resultIssueLinks.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 rounded border border-border bg-surface-raised/40 px-2 py-1.5 text-sm">
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">
                          {l.title || l.url}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeResultIssueLink(l.id)}
                          className="shrink-0 text-muted hover:text-error"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <form onSubmit={addResultIssueLink} className="flex flex-wrap gap-2">
                    <input
                      value={newIssueUrl}
                      onChange={(e) => setNewIssueUrl(e.target.value)}
                      placeholder="Defect URL"
                      required
                      className="min-w-[160px] flex-1 rounded-lg border border-border bg-surface-raised text-text px-2 py-1.5 text-sm"
                    />
                    <input
                      value={newIssueTitle}
                      onChange={(e) => setNewIssueTitle(e.target.value)}
                      placeholder="Title (optional)"
                      className="rounded-lg border border-border bg-surface-raised text-text px-2 py-1.5 text-sm"
                    />
                    <Button type="submit" variant="primary">Add link</Button>
                  </form>
                </>
              )}
            </div>
          </>
        )}

        {/* Attachments for the latest result */}
        {latestResultId && (
          <div className="mt-3 border-t border-border pt-3">
            <AttachmentPanel entityType="result" entityId={latestResultId} />
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 border-t border-border bg-surface-raised/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={submitting}
            onClick={() => submitResult()}
          >
            {submitting ? "Saving…" : "+ Add Result"}
          </Button>
          <div className="flex">
            <Button
              type="button"
              variant="primary"
              disabled={submitting}
              onClick={() => submitResult("passed", true)}
              className="rounded-r-none"
            >
              ✓ Pass & Next
            </Button>
            <select
              className="rounded-r-lg border border-l-0 border-border bg-surface-raised px-2 py-1.5 text-sm text-muted focus:outline-none"
              onChange={(e) => {
                const v = e.target.value;
                if (v) submitResult(v as typeof STATUSES[number], true);
                e.target.value = "";
              }}
              value=""
            >
              <option value="">▼</option>
              <option value="failed">Fail & Next</option>
              <option value="blocked">Blocked & Next</option>
              <option value="skipped">Skip & Next</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <label className="text-xs text-muted">Assignee</label>
            <select
              value={assigneeId ?? ""}
              onChange={(e) => handleAssigneeChange(e.target.value || null)}
              disabled={assigneeWorking || members.length === 0}
              aria-label="Assign test to member"
              className="rounded-lg border border-border bg-surface-raised text-text px-2 py-1.5 text-xs focus:border-primary focus:outline-none disabled:opacity-50"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name ?? m.userId.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}