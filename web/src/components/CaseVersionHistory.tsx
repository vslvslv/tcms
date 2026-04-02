import { useEffect, useState } from "react";
import { api, type CaseVersion, type VersionDiffResult, type User } from "../api";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { LoadingSpinner } from "./ui/LoadingSpinner";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function DiffRow({ label, oldVal, newVal }: { label: string; oldVal: string | null; newVal: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
      <div className="flex gap-4">
        <div className="flex-1 rounded bg-red-50 px-2 py-1 text-sm line-through">{oldVal || "(empty)"}</div>
        <div className="flex-1 rounded bg-green-50 px-2 py-1 text-sm">{newVal || "(empty)"}</div>
      </div>
    </div>
  );
}

type StepSnapshot = { content: string; expected: string | null; sortOrder: number; sharedStepId?: string };

function StepsDiff({ oldSteps, newSteps }: { oldSteps: StepSnapshot[]; newSteps: StepSnapshot[] }) {
  const maxLen = Math.max(oldSteps.length, newSteps.length);
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 text-xs font-medium text-slate-500">Steps</div>
      <div className="space-y-1">
        {Array.from({ length: maxLen }, (_, i) => {
          const old = oldSteps[i];
          const cur = newSteps[i];
          const removed = old && !cur;
          const added = !old && cur;
          const changed = old && cur && (old.content !== cur.content || (old.expected ?? "") !== (cur.expected ?? ""));
          const unchanged = old && cur && !changed;

          return (
            <div
              key={i}
              className={`flex gap-2 rounded px-2 py-1 text-sm ${
                removed ? "bg-red-50" : added ? "bg-green-50" : changed ? "bg-yellow-50" : ""
              }`}
            >
              <span className="w-6 shrink-0 text-slate-400">{i + 1}.</span>
              <div className="flex-1">
                {removed && <span className="line-through text-red-700">{old.content}</span>}
                {added && <span className="text-green-700">{cur.content}</span>}
                {changed && (
                  <>
                    <span className="line-through text-red-700">{old.content}</span>
                    {" → "}
                    <span className="text-green-700">{cur.content}</span>
                  </>
                )}
                {unchanged && <span>{cur.content}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CaseVersionHistory({ caseId }: { caseId: string }) {
  const [versions, setVersions] = useState<CaseVersion[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedFrom, setSelectedFrom] = useState("");
  const [selectedTo, setSelectedTo] = useState("");
  const [diffResult, setDiffResult] = useState<VersionDiffResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [diffLoading, setDiffLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api<CaseVersion[]>(`/api/cases/${caseId}/versions`),
      api<User[]>("/api/users"),
    ])
      .then(([v, u]) => {
        setVersions(v);
        setUsers(u);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [caseId]);

  function resolveUser(userId: string) {
    const u = users.find((u) => u.id === userId);
    return u?.name || u?.email || userId.slice(0, 8);
  }

  async function loadDiff() {
    if (!selectedFrom || !selectedTo) return;
    setDiffLoading(true);
    setDiffResult(null);
    try {
      const result = await api<VersionDiffResult>(
        `/api/cases/${caseId}/versions/diff?from=${encodeURIComponent(selectedFrom)}&to=${encodeURIComponent(selectedTo)}`
      );
      setDiffResult(result);
    } catch {
      setDiffResult(null);
    } finally {
      setDiffLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (versions.length === 0) return null;

  return (
    <Card className="p-6">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Version History</h3>
      <div className="space-y-1">
        {versions.map((v, idx) => {
          const versionNum = versions.length - idx;
          return (
            <div key={v.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <input
                type="radio"
                name="diff-from"
                checked={selectedFrom === v.id}
                onChange={() => { setSelectedFrom(v.id); setDiffResult(null); }}
                className="accent-primary"
              />
              <input
                type="radio"
                name="diff-to"
                checked={selectedTo === v.id}
                onChange={() => { setSelectedTo(v.id); setDiffResult(null); }}
                className="accent-primary"
              />
              <div className="flex-1">
                <span className="font-medium">v{versionNum}</span>
                <span className="ml-2 text-muted">{formatRelativeTime(v.createdAt)}</span>
                <span className="ml-2 text-muted">by {resolveUser(v.createdBy)}</span>
              </div>
              <span className="text-xs text-muted">{v.title.slice(0, 40)}{v.title.length > 40 ? "..." : ""}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <Button
          type="button"
          variant="secondary"
          onClick={loadDiff}
          disabled={!selectedFrom || !selectedTo || selectedFrom === selectedTo || diffLoading}
        >
          {diffLoading ? "Loading..." : "Compare versions"}
        </Button>
      </div>

      {diffResult && (
        <div className="mt-4 space-y-3">
          {diffResult.changes.length === 0 && (
            <p className="text-sm text-muted">No differences found between these versions.</p>
          )}
          {diffResult.changes.map((c, i) => {
            if (c.field === "steps") {
              const oldSteps: StepSnapshot[] = c.old ? JSON.parse(c.old) : [];
              const newSteps: StepSnapshot[] = c.new ? JSON.parse(c.new) : [];
              return <StepsDiff key={i} oldSteps={oldSteps} newSteps={newSteps} />;
            }
            return <DiffRow key={i} label={c.field} oldVal={c.old} newVal={c.new} />;
          })}
        </div>
      )}
    </Card>
  );
}
