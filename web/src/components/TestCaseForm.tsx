import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  type TestCase,
  type TestStep,
  type CaseType,
  type Priority,
  type CaseFieldDefinition,
  type SharedStep,
  type CaseTemplate,
  type IssueLink,
  type RequirementLink,
  type Dataset,
  type Section,
  type Suite,
  type User,
} from "../api";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { LoadingSpinner } from "./ui/LoadingSpinner";
import { Select } from "./ui/Select";
import { StatusBadge } from "./ui/StatusBadge";
import { CaseVersionHistory } from "./CaseVersionHistory";
import { AttachmentPanel } from "./AttachmentPanel";

type StepRow = { content: string; expected: string; sharedStepId?: string };

export type TestCaseFormProps = {
  sectionId?: string;
  caseId?: string;
  templateId?: string | null;
  onSuccess?: (caseData: TestCase) => void;
  onCancel?: () => void;
  compact?: boolean;
};

export function TestCaseForm({
  sectionId: sectionIdProp,
  caseId,
  templateId,
  onSuccess,
  onCancel,
  compact = false,
}: TestCaseFormProps) {
  const navigate = useNavigate();
  const isEdit = Boolean(caseId);

  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [caseFields, setCaseFields] = useState<CaseFieldDefinition[]>([]);
  const [sharedStepsList, setSharedStepsList] = useState<SharedStep[]>([]);
  const [datasetsList, setDatasetsList] = useState<Dataset[]>([]);
  const [title, setTitle] = useState("");
  const [prerequisite, setPrerequisite] = useState("");
  const [caseTypeId, setCaseTypeId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [status, setStatus] = useState<"draft" | "ready" | "approved">("draft");
  const [datasetId, setDatasetId] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [steps, setSteps] = useState<StepRow[]>([{ content: "", expected: "" }]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState("");

  // Approval
  const [approvedById, setApprovedById] = useState<string | null>(null);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [approverName, setApproverName] = useState<string | null>(null);

  const [issueLinksList, setIssueLinksList] = useState<IssueLink[]>([]);
  const [newIssueUrl, setNewIssueUrl] = useState("");
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [requirementLinksList, setRequirementLinksList] = useState<RequirementLink[]>([]);
  const [newRequirementRef, setNewRequirementRef] = useState("");
  const [newRequirementTitle, setNewRequirementTitle] = useState("");

  const canApprove = myRole === "admin" || myRole === "lead";

  useEffect(() => {
    let cancelled = false;

    if (isEdit && caseId) {
      api<TestCase & { steps?: TestStep[]; customFields?: { caseFieldId: string; value: string }[] }>(`/api/cases/${caseId}`)
        .then((c) => {
          if (cancelled) return;
          setTitle(c.title);
          setPrerequisite(c.prerequisite ?? "");
          setCaseTypeId(c.caseTypeId ?? "");
          setPriorityId(c.priorityId ?? "");
          setStatus((c.status ?? "draft") as "draft" | "ready" | "approved");
          setDatasetId((c as { datasetId?: string | null }).datasetId ?? "");
          setApprovedById((c as { approvedById?: string | null }).approvedById ?? null);
          setApprovedAt((c as { approvedAt?: string | null }).approvedAt ?? null);
          setSteps(
            c.steps?.length
              ? c.steps.map((s) => ({
                  content: s.content,
                  expected: s.expected ?? "",
                  ...(s.sharedStepId && { sharedStepId: s.sharedStepId }),
                }))
              : [{ content: "", expected: "" }]
          );
          const byField = (c.customFields ?? []).reduce<Record<string, string>>((acc, f) => {
            acc[f.caseFieldId] = f.value;
            return acc;
          }, {});
          setCustomValues(byField);
          return api<Section>(`/api/sections/${c.sectionId}`).then((sec) => ({ caseData: c, section: sec }));
        })
        .then((data) => {
          if (cancelled || !data) return;
          return api<Suite>(`/api/suites/${data.section.suiteId}`).then((suite) => ({ ...data, suite }));
        })
        .then((data) => {
          if (cancelled || !data) return;
          const projectId = data.suite.projectId;
          api<{ role: string }>(`/api/projects/${projectId}/my-role`)
            .then((r) => {
              if (!cancelled) setMyRole(r.role);
            })
            .catch(() => {
              if (!cancelled) setMyRole(null);
            });
          return Promise.all([
            projectId,
            api<CaseType[]>(`/api/projects/${projectId}/case-types`),
            api<Priority[]>(`/api/projects/${projectId}/priorities`),
            api<CaseFieldDefinition[]>(`/api/projects/${projectId}/case-fields`),
            api<SharedStep[]>(`/api/projects/${projectId}/shared-steps`),
            api<Dataset[]>(`/api/projects/${projectId}/datasets`),
          ]);
        })
        .then((result) => {
          if (cancelled || !result) return;
          const [, ct, pr, cf, ss, ds] = result;
          setCaseTypes(ct);
          setPriorities(pr);
          setCaseFields(cf);
          setSharedStepsList(ss);
          setDatasetsList(ds);
          return Promise.all([
            api<IssueLink[]>(`/api/cases/${caseId}/issue-links`),
            api<RequirementLink[]>(`/api/cases/${caseId}/requirement-links`),
          ]);
        })
        .then((res) => {
          if (cancelled) return;
          const [issues = [], reqs = []] = res ?? [];
          setIssueLinksList(issues);
          setRequirementLinksList(reqs);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    const sectionId = sectionIdProp;
    if (!sectionId) {
      setLoading(false);
      return;
    }

    api<Section>(`/api/sections/${sectionId}`)
      .then((sec) => api<Suite>(`/api/suites/${sec.suiteId}`))
      .then((suite) => {
        if (cancelled) return null;
        return suite.projectId;
      })
      .then((projectId) => {
        if (cancelled || !projectId) return;
        return Promise.all([
          api<CaseType[]>(`/api/projects/${projectId}/case-types`),
          api<Priority[]>(`/api/projects/${projectId}/priorities`),
          api<CaseFieldDefinition[]>(`/api/projects/${projectId}/case-fields`),
          api<SharedStep[]>(`/api/projects/${projectId}/shared-steps`),
          api<Dataset[]>(`/api/projects/${projectId}/datasets`),
        ]).then(([ct, pr, cf, ss, ds]) => {
          if (cancelled) return;
          setCaseTypes(ct);
          setPriorities(pr);
          setCaseFields(cf);
          setSharedStepsList(ss);
          setDatasetsList(ds);
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    if (templateId) {
      api<CaseTemplate>(`/api/case-templates/${templateId}`)
        .then((tmpl) => {
          if (cancelled || !tmpl.defaultSteps?.length) return;
          setTitle(tmpl.name);
          setSteps(
            tmpl.defaultSteps.map((s) => ({
              content: s.content,
              expected: s.expected ?? "",
            }))
          );
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [caseId, sectionIdProp, templateId, isEdit]);

  // Resolve approver name
  useEffect(() => {
    if (!approvedById) {
      setApproverName(null);
      return;
    }
    api<User[]>("/api/users")
      .then((users) => {
        const u = users.find((u) => u.id === approvedById);
        setApproverName(u?.name || u?.email || null);
      })
      .catch(() => {});
  }, [approvedById]);

  const customFieldsPayload = useMemo(() => {
    return caseFields
      .filter((f) => customValues[f.id] !== undefined && customValues[f.id] !== "")
      .map((f) => ({ caseFieldId: f.id, value: customValues[f.id] }));
  }, [caseFields, customValues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title,
        prerequisite: prerequisite || undefined,
        caseTypeId: caseTypeId || null,
        priorityId: priorityId || null,
        status,
        datasetId: datasetId || null,
        customFields: customFieldsPayload.length > 0 ? customFieldsPayload : undefined,
      };
      const stepsPayload = steps
        .filter((s) => s.content.trim())
        .map((s, i) =>
          s.sharedStepId
            ? { sharedStepId: s.sharedStepId, sortOrder: i }
            : { content: s.content, expected: s.expected || undefined, sortOrder: i }
        );

      if (isEdit && caseId) {
        await api(`/api/cases/${caseId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...body, steps: stepsPayload }),
        });
        const updated = await api<TestCase>(`/api/cases/${caseId}`);
        if (onSuccess) onSuccess(updated);
        else navigate(-1);
      } else if (sectionIdProp) {
        if (templateId) {
          body.templateId = templateId;
        } else {
          body.steps = stepsPayload;
        }
        const created = await api<TestCase & { steps?: TestStep[] }>(`/api/sections/${sectionIdProp}/cases`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (onSuccess) onSuccess(created);
        else navigate(`/cases/${created.id}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleApproval(newStatus: "approved" | "ready") {
    if (!caseId) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/cases/${caseId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setStatus(newStatus);
      if (newStatus === "approved") {
        const updated = await api<TestCase & { approvedById?: string; approvedAt?: string }>(`/api/cases/${caseId}`);
        setApprovedById(updated.approvedById ?? null);
        setApprovedAt(updated.approvedAt ?? null);
      } else {
        setApprovedById(null);
        setApprovedAt(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    if (!caseId) return;
    setDuplicating(true);
    setError("");
    try {
      const duplicate = await api<TestCase>(`/api/cases/${caseId}/duplicate`, { method: "POST" });
      navigate(`/cases/${duplicate.id}/edit`, { replace: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setDuplicating(false);
    }
  }

  function setCustomValue(fieldId: string, value: string) {
    setCustomValues((prev) => ({ ...prev, [fieldId]: value }));
  }
  function addStep() {
    setSteps((s) => [...s, { content: "", expected: "" }]);
  }
  function insertSharedStep(shared: SharedStep) {
    setSteps((s) => [...s, { content: shared.content, expected: shared.expected ?? "", sharedStepId: shared.id }]);
  }
  function removeStep(i: number) {
    setSteps((s) => s.filter((_, idx) => idx !== i));
  }
  function unlinkSharedStep(i: number) {
    setSteps((s) => s.map((step, idx) => (idx === i ? { content: step.content, expected: step.expected } : step)));
  }
  function updateStep(i: number, field: "content" | "expected", value: string) {
    setSteps((s) => s.map((step, idx) => (idx === i ? { ...step, [field]: value } : step)));
  }

  async function addIssueLink(e: React.FormEvent) {
    e.preventDefault();
    if (!caseId || !newIssueUrl.trim()) return;
    try {
      await api<IssueLink>(`/api/cases/${caseId}/issue-links`, {
        method: "POST",
        body: JSON.stringify({ url: newIssueUrl.trim(), title: newIssueTitle.trim() || undefined }),
      });
      setNewIssueUrl("");
      setNewIssueTitle("");
      const list = await api<IssueLink[]>(`/api/cases/${caseId}/issue-links`);
      setIssueLinksList(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add link");
    }
  }
  async function removeIssueLink(linkId: string) {
    try {
      await api(`/api/issue-links/${linkId}`, { method: "DELETE" });
      const list = await api<IssueLink[]>(`/api/cases/${caseId}/issue-links`);
      setIssueLinksList(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove link");
    }
  }
  async function addRequirementLink(e: React.FormEvent) {
    e.preventDefault();
    if (!caseId || !newRequirementRef.trim()) return;
    try {
      await api<RequirementLink>(`/api/cases/${caseId}/requirement-links`, {
        method: "POST",
        body: JSON.stringify({ requirementRef: newRequirementRef.trim(), title: newRequirementTitle.trim() || undefined }),
      });
      setNewRequirementRef("");
      setNewRequirementTitle("");
      const list = await api<RequirementLink[]>(`/api/cases/${caseId}/requirement-links`);
      setRequirementLinksList(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add requirement link");
    }
  }
  async function removeRequirementLink(linkId: string) {
    try {
      await api(`/api/requirement-links/${linkId}`, { method: "DELETE" });
      const list = await api<RequirementLink[]>(`/api/cases/${caseId}/requirement-links`);
      setRequirementLinksList(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove link");
    }
  }

  const formClass = compact ? "space-y-3" : "space-y-4";
  const inputClass =
    "w-full rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  if (loading) return <LoadingSpinner />;
  if (error && !title) return <p className="text-error">{error}</p>;

  return (
    <div className="max-w-2xl space-y-8">
      <Card className={compact ? "p-4" : "p-6"}>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text font-mono">
            {isEdit ? "Edit test case" : "New test case"}
          </h2>
          {isEdit && <StatusBadge status={status} />}
        </div>
        <form onSubmit={handleSubmit} className={formClass}>
          {error && <p className="text-sm text-error">{error}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputClass}
              placeholder="Case title"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Prerequisite</label>
            <textarea
              value={prerequisite}
              onChange={(e) => setPrerequisite(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Optional prerequisite"
            />
          </div>
          {caseTypes.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">Case type</label>
              <Select value={caseTypeId} onChange={(e) => setCaseTypeId(e.target.value)} className={inputClass}>
                <option value="">— None —</option>
                {caseTypes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          )}
          {priorities.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">Priority</label>
              <Select value={priorityId} onChange={(e) => setPriorityId(e.target.value)} className={inputClass}>
                <option value="">— None —</option>
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Status</label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "ready" | "approved")}
              className={inputClass}
            >
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="approved" disabled={isEdit && !canApprove}>
                Approved {isEdit && !canApprove ? "(admin/lead only)" : ""}
              </option>
            </Select>
            {/* Approval actions */}
            {isEdit && canApprove && (
              <div className="mt-2 flex items-center gap-2">
                {status === "ready" && (
                  <Button type="button" variant="primary" onClick={() => handleApproval("approved")} disabled={saving}>
                    Approve
                  </Button>
                )}
                {status === "approved" && (
                  <Button type="button" variant="ghost" onClick={() => handleApproval("ready")} disabled={saving}>
                    Revoke approval
                  </Button>
                )}
              </div>
            )}
            {/* Approval info */}
            {status === "approved" && approverName && approvedAt && (
              <p className="mt-1 text-xs text-muted">
                Approved by {approverName} on {new Date(approvedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          {datasetsList.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">Dataset</label>
              <Select value={datasetId} onChange={(e) => setDatasetId(e.target.value)} className={inputClass}>
                <option value="">— None —</option>
                {datasetsList.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
          )}
          {caseFields.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-muted">Custom fields</h4>
              <div className="space-y-2">
                {caseFields.map((f) => (
                  <div key={f.id}>
                    <label className="mb-0.5 block text-xs text-muted">{f.name}</label>
                    {f.fieldType === "text" && (
                      <input
                        value={customValues[f.id] ?? ""}
                        onChange={(e) => setCustomValue(f.id, e.target.value)}
                        className={inputClass}
                      />
                    )}
                    {f.fieldType === "multiline" && (
                      <textarea
                        value={customValues[f.id] ?? ""}
                        onChange={(e) => setCustomValue(f.id, e.target.value)}
                        rows={2}
                        className={inputClass}
                      />
                    )}
                    {f.fieldType === "number" && (
                      <input
                        type="number"
                        value={customValues[f.id] ?? ""}
                        onChange={(e) => setCustomValue(f.id, e.target.value)}
                        className={inputClass}
                      />
                    )}
                    {f.fieldType === "dropdown" && (
                      <Select
                        value={customValues[f.id] ?? ""}
                        onChange={(e) => setCustomValue(f.id, e.target.value)}
                        className={inputClass}
                      >
                        <option value="">—</option>
                        {(f.options ?? []).map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted">Steps</h4>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${
                    step.sharedStepId
                      ? "border-primary/30 bg-primary/10"
                      : "border-border bg-surface-raised/40"
                  }`}
                >
                  {step.sharedStepId && (
                    <span className="mb-2 inline-flex items-center gap-1 rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                      Shared step
                    </span>
                  )}
                  <div className="mb-2">
                    <label className="mb-0.5 block text-xs text-muted">Action</label>
                    <input
                      value={step.content}
                      onChange={(e) => updateStep(i, "content", e.target.value)}
                      className={`${inputClass} ${step.sharedStepId ? "cursor-not-allowed bg-surface-raised" : ""}`}
                      readOnly={!!step.sharedStepId}
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs text-muted">Expected</label>
                    <input
                      value={step.expected}
                      onChange={(e) => updateStep(i, "expected", e.target.value)}
                      className={`${inputClass} ${step.sharedStepId ? "cursor-not-allowed bg-surface-raised" : ""}`}
                      readOnly={!!step.sharedStepId}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" onClick={() => removeStep(i)} className="text-sm text-muted hover:text-error">
                      Remove step
                    </button>
                    {step.sharedStepId && (
                      <button type="button" onClick={() => unlinkSharedStep(i)} className="text-sm text-muted hover:text-primary">
                        Unlink
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={addStep}>
                Add step
              </Button>
              {sharedStepsList.length > 0 && (
                <span className="text-sm text-muted">
                  Insert shared:{" "}
                  <Select
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id) {
                        const sh = sharedStepsList.find((s) => s.id === id);
                        if (sh) insertSharedStep(sh);
                        (e.target as HTMLSelectElement).value = "";
                      }
                    }}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                  >
                    <option value="">— Choose —</option>
                    {sharedStepsList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.content.slice(0, 40)}{s.expected ? ` → ${s.expected.slice(0, 20)}` : ""}{s.content.length > 40 ? "..." : ""}
                      </option>
                    ))}
                  </Select>
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            {isEdit && (
              <Button type="button" variant="secondary" onClick={handleDuplicate} disabled={duplicating || saving}>
                {duplicating ? "Duplicating..." : "Duplicate"}
              </Button>
            )}
            {onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      {isEdit && caseId && (
        <>
          <Card className="p-6">
            <h3 className="mb-3 text-sm font-semibold text-text font-mono">Defects / Issues</h3>
            <ul className="list-none space-y-2 p-0 text-sm">
              {issueLinksList.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {l.title || l.url}
                  </a>
                  <button type="button" onClick={() => removeIssueLink(l.id)} className="text-muted hover:text-error">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={addIssueLink} className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={newIssueUrl}
                onChange={(e) => setNewIssueUrl(e.target.value)}
                placeholder="URL"
                required
                className="min-w-[200px] rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm"
              />
              <input
                value={newIssueTitle}
                onChange={(e) => setNewIssueTitle(e.target.value)}
                placeholder="Title (optional)"
                className="rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm"
              />
              <Button type="submit" variant="primary">Add link</Button>
            </form>
          </Card>

          <Card className="p-6">
            <h3 className="mb-3 text-sm font-semibold text-text font-mono">Requirements</h3>
            <ul className="list-none space-y-2 p-0 text-sm">
              {requirementLinksList.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  {l.title ? `${l.requirementRef}: ${l.title}` : l.requirementRef}
                  <button type="button" onClick={() => removeRequirementLink(l.id)} className="text-muted hover:text-error">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={addRequirementLink} className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={newRequirementRef}
                onChange={(e) => setNewRequirementRef(e.target.value)}
                placeholder="Requirement ref (e.g. REQ-001)"
                required
                className="min-w-[160px] rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm"
              />
              <input
                value={newRequirementTitle}
                onChange={(e) => setNewRequirementTitle(e.target.value)}
                placeholder="Title (optional)"
                className="rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm"
              />
              <Button type="submit" variant="primary">Add requirement</Button>
            </form>
          </Card>

          <AttachmentPanel entityType="case" entityId={caseId} />

          <CaseVersionHistory caseId={caseId} />
        </>
      )}
    </div>
  );
}
