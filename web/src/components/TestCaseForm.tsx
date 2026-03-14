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
  type CaseVersion,
  type IssueLink,
  type RequirementLink,
  type Dataset,
  type Section,
  type Suite,
} from "../api";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { LoadingSpinner } from "./ui/LoadingSpinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/Select";

type StepRow = { content: string; expected: string; sharedStepId?: string };

export type TestCaseFormProps = {
  /** For creating a new case */
  sectionId?: string;
  /** For editing an existing case (takes precedence over sectionId) */
  caseId?: string;
  templateId?: string | null;
  /** Called after successful save; if not provided, create navigates to edit page, edit navigates back */
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
  const [error, setError] = useState("");

  const [issueLinksList, setIssueLinksList] = useState<IssueLink[]>([]);
  const [newIssueUrl, setNewIssueUrl] = useState("");
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [requirementLinksList, setRequirementLinksList] = useState<RequirementLink[]>([]);
  const [newRequirementRef, setNewRequirementRef] = useState("");
  const [newRequirementTitle, setNewRequirementTitle] = useState("");
  const [versions, setVersions] = useState<CaseVersion[]>([]);
  const [sharedStepSelectValue, setSharedStepSelectValue] = useState("");
  const [diffFrom, setDiffFrom] = useState("");
  const [diffTo, setDiffTo] = useState("");
  const [diffResult, setDiffResult] = useState<{
    from: CaseVersion;
    to: CaseVersion;
    changes: { field: string; old: string | null; new: string | null }[];
  } | null>(null);

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
          const [_pid, ct, pr, cf, ss, ds] = result;
          setCaseTypes(ct);
          setPriorities(pr);
          setCaseFields(cf);
          setSharedStepsList(ss);
          setDatasetsList(ds);
          return Promise.all([
            api<CaseVersion[]>(`/api/cases/${caseId}/versions`),
            api<IssueLink[]>(`/api/cases/${caseId}/issue-links`),
            api<RequirementLink[]>(`/api/cases/${caseId}/requirement-links`),
          ]);
        })
        .then((res) => {
          if (cancelled) return;
          const [ver = [], issues = [], reqs = []] = res ?? [];
          setVersions(ver);
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
  function updateStep(i: number, field: "content" | "expected", value: string) {
    setSteps((s) => s.map((step, idx) => (idx === i ? { ...step, [field]: value } : step)));
  }

  function loadDiff() {
    if (!caseId || !diffFrom || !diffTo) return;
    api<{ from: CaseVersion; to: CaseVersion; changes: { field: string; old: string | null; new: string | null }[] }>(
      `/api/cases/${caseId}/versions/diff?from=${encodeURIComponent(diffFrom)}&to=${encodeURIComponent(diffTo)}`
    )
      .then(setDiffResult)
      .catch(() => setDiffResult(null));
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
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

  if (loading) return <LoadingSpinner />;
  if (error && !title) return <p className="text-error">{error}</p>;

  return (
    <div className="max-w-2xl space-y-8">
      <Card className={compact ? "p-4" : "p-6"}>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {isEdit ? "Edit test case" : "New test case"}
        </h2>
        <form onSubmit={handleSubmit} className={formClass}>
          {error && <p className="text-sm text-error">{error}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputClass}
              placeholder="Case title"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Prerequisite</label>
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
              <label className="mb-1 block text-sm font-medium text-foreground">Case type</label>
              <Select value={caseTypeId} onValueChange={setCaseTypeId}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="— None —" />
                </SelectTrigger>
                <SelectContent>
                  {caseTypes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {priorities.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Priority</label>
              <Select value={priorityId} onValueChange={setPriorityId}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="— None —" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "ready" | "approved")}>
              <SelectTrigger className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="approved" disabled={isEdit && myRole !== "admin" && myRole !== "lead"}>
                  Approved {isEdit && myRole !== "admin" && myRole !== "lead" ? "(admin/lead only)" : ""}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {datasetsList.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Dataset</label>
              <Select value={datasetId} onValueChange={setDatasetId}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="— None —" />
                </SelectTrigger>
                <SelectContent>
                  {datasetsList.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {caseFields.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Custom fields</h4>
              <div className="space-y-2">
                {caseFields.map((f) => (
                  <div key={f.id}>
                    <label className="mb-0.5 block text-xs text-muted-foreground">{f.name}</label>
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
                      <Select value={customValues[f.id] ?? ""} onValueChange={(v) => setCustomValue(f.id, v)}>
                        <SelectTrigger className={inputClass}>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <h4 className="mb-2 text-sm font-medium text-foreground">Steps</h4>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/40 p-3">
                  {step.sharedStepId && <div className="mb-2 text-xs text-muted-foreground">Shared step</div>}
                  <div className="mb-2">
                    <label className="mb-0.5 block text-xs text-muted-foreground">Action</label>
                    <input
                      value={step.content}
                      onChange={(e) => updateStep(i, "content", e.target.value)}
                      className={inputClass}
                      readOnly={!!step.sharedStepId}
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs text-muted-foreground">Expected</label>
                    <input
                      value={step.expected}
                      onChange={(e) => updateStep(i, "expected", e.target.value)}
                      className={inputClass}
                      readOnly={!!step.sharedStepId}
                    />
                  </div>
                  <button type="button" onClick={() => removeStep(i)} className="mt-2 text-sm text-muted-foreground hover:text-error">
                    Remove step
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={addStep}>
                Add step
              </Button>
              {sharedStepsList.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  Insert shared:{" "}
                  <Select
                    value={sharedStepSelectValue}
                    onValueChange={(id) => {
                      if (id) {
                        const sh = sharedStepsList.find((s) => s.id === id);
                        if (sh) insertSharedStep(sh);
                        setSharedStepSelectValue("");
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-lg border border-border bg-surface px-2 py-1 text-sm">
                      <SelectValue placeholder="— Choose —" />
                    </SelectTrigger>
                    <SelectContent>
                      {sharedStepsList.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.content.slice(0, 50)}{s.content.length > 50 ? "…" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
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
            <h3 className="mb-3 text-sm font-semibold text-foreground">Defects / Issues</h3>
            <ul className="list-none space-y-2 p-0 text-sm">
              {issueLinksList.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {l.title || l.url}
                  </a>
                  <button type="button" onClick={() => removeIssueLink(l.id)} className="text-muted-foreground hover:text-error">
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
                className="min-w-[200px] rounded-lg border border-input px-3 py-2 text-sm"
              />
              <input
                value={newIssueTitle}
                onChange={(e) => setNewIssueTitle(e.target.value)}
                placeholder="Title (optional)"
                className="rounded-lg border border-input px-3 py-2 text-sm"
              />
              <Button type="submit" variant="primary">Add link</Button>
            </form>
          </Card>

          <Card className="p-6">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Requirements</h3>
            <ul className="list-none space-y-2 p-0 text-sm">
              {requirementLinksList.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  {l.title ? `${l.requirementRef}: ${l.title}` : l.requirementRef}
                  <button type="button" onClick={() => removeRequirementLink(l.id)} className="text-muted-foreground hover:text-error">
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
                className="min-w-[160px] rounded-lg border border-input px-3 py-2 text-sm"
              />
              <input
                value={newRequirementTitle}
                onChange={(e) => setNewRequirementTitle(e.target.value)}
                placeholder="Title (optional)"
                className="rounded-lg border border-input px-3 py-2 text-sm"
              />
              <Button type="submit" variant="primary">Add requirement</Button>
            </form>
          </Card>

          {versions.length > 0 && (
            <Card className="p-6">
              <h3 className="mb-3 text-sm font-semibold text-foreground">History</h3>
              <ul className="list-none space-y-1 p-0 text-sm text-muted-foreground">
                {versions.map((v) => (
                  <li key={v.id}>
                    {new Date(v.createdAt).toLocaleString()} — v {v.id.slice(0, 8)}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-sm text-muted-foreground">Compare:</label>
                <Select
                  value={diffFrom}
                  onValueChange={(v) => {
                    setDiffFrom(v);
                    setDiffResult(null);
                  }}
                >
                  <SelectTrigger className="rounded-lg border border-border px-2 py-1.5 text-sm">
                    <SelectValue placeholder="— From —" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{new Date(v.createdAt).toLocaleString()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={diffTo}
                  onValueChange={(v) => {
                    setDiffTo(v);
                    setDiffResult(null);
                  }}
                >
                  <SelectTrigger className="rounded-lg border border-border px-2 py-1.5 text-sm">
                    <SelectValue placeholder="— To —" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{new Date(v.createdAt).toLocaleString()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={loadDiff} disabled={!diffFrom || !diffTo}>
                  Show diff
                </Button>
              </div>
              {diffResult && (
                <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3 text-sm">
                  <strong>Changes:</strong>
                  <ul className="mt-2 list-inside list-disc pl-2">
                    {diffResult.changes.map((c, i) => (
                      <li key={i}>
                        <strong>{c.field}:</strong> {c.old ?? "(empty)"} → {c.new ?? "(empty)"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
