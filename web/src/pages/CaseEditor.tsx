import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { api, type TestCase, type TestStep, type CaseType, type Priority, type CaseFieldDefinition, type SharedStep, type CaseVersion, type CaseTemplate, type IssueLink, type Dataset, type Suite, type Section } from "../api";

type StepRow = { content: string; expected: string; sharedStepId?: string };

export default function CaseEditor() {
  const { caseId, sectionId } = useParams<{ caseId?: string; sectionId?: string }>();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId");
  const navigate = useNavigate();
  const isNew = !caseId;
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [caseFields, setCaseFields] = useState<CaseFieldDefinition[]>([]);
  const [sharedStepsList, setSharedStepsList] = useState<SharedStep[]>([]);
  const [datasetsList, setDatasetsList] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [versions, setVersions] = useState<CaseVersion[]>([]);
  const [diffFrom, setDiffFrom] = useState("");
  const [diffTo, setDiffTo] = useState("");
  const [diffResult, setDiffResult] = useState<{ from: CaseVersion; to: CaseVersion; changes: { field: string; old: string | null; new: string | null }[] } | null>(null);
  const [issueLinksList, setIssueLinksList] = useState<IssueLink[]>([]);
  const [newIssueUrl, setNewIssueUrl] = useState("");
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [title, setTitle] = useState("");
  const [prerequisite, setPrerequisite] = useState("");
  const [caseTypeId, setCaseTypeId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [steps, setSteps] = useState<StepRow[]>([{ content: "", expected: "" }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (caseId) {
        const c = await api<TestCase & { steps?: TestStep[]; customFields?: { caseFieldId: string; value: string }[] }>(`/api/cases/${caseId}`);
        if (cancelled) return;
        setTitle(c.title);
        setPrerequisite(c.prerequisite ?? "");
        setCaseTypeId(c.caseTypeId ?? "");
        setPriorityId(c.priorityId ?? "");
        setDatasetId((c as { datasetId?: string | null }).datasetId ?? "");
        setSteps(
          c.steps && c.steps.length > 0
            ? c.steps.map((s) => ({ content: s.content, expected: s.expected ?? "", ...(s.sharedStepId && { sharedStepId: s.sharedStepId }) }))
            : [{ content: "", expected: "" }]
        );
        const byField = (c.customFields ?? []).reduce<Record<string, string>>((acc, f) => {
          acc[f.caseFieldId] = f.value;
          return acc;
        }, {});
        setCustomValues(byField);
        api<CaseVersion[]>(`/api/cases/${c.id}/versions`).then((v) => setVersions(v)).catch(() => setVersions([]));
        api<IssueLink[]>(`/api/cases/${c.id}/issue-links`).then(setIssueLinksList).catch(() => setIssueLinksList([]));
        const sec = await api<Section>(`/api/sections/${c.sectionId}`);
        if (cancelled) return;
        const suite = await api<Suite>(`/api/suites/${sec.suiteId}`);
        if (cancelled) return;
        return suite.projectId;
      }
      if (sectionId) {
        const sec = await api<Section>(`/api/sections/${sectionId}`);
        if (cancelled) return;
        const suite = await api<Suite>(`/api/suites/${sec.suiteId}`);
        if (cancelled) return;
        if (templateId) {
          const tmpl = await api<CaseTemplate>(`/api/case-templates/${templateId}`);
          if (!cancelled && tmpl.defaultSteps && tmpl.defaultSteps.length > 0) {
            setTitle(tmpl.name);
            setSteps(
              tmpl.defaultSteps.map((s) => ({
                content: s.content,
                expected: s.expected ?? "",
              }))
            );
          }
        }
        return suite.projectId;
      }
      setLoading(false);
      return null;
    }
    run()
      .then((pid) => {
        if (cancelled || !pid) {
          if (!caseId && !sectionId) setLoading(false);
          return;
        }
        return Promise.all([
          api<CaseType[]>(`/api/projects/${pid}/case-types`),
          api<Priority[]>(`/api/projects/${pid}/priorities`),
          api<CaseFieldDefinition[]>(`/api/projects/${pid}/case-fields`),
          api<SharedStep[]>(`/api/projects/${pid}/shared-steps`),
          api<Dataset[]>(`/api/projects/${pid}/datasets`),
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
    return () => {
      cancelled = true;
    };
  }, [caseId, sectionId]);

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
        datasetId: datasetId || null,
        customFields: customFieldsPayload.length > 0 ? customFieldsPayload : undefined,
      };
      if (isNew && sectionId) {
        if (templateId) {
          body.templateId = templateId;
        } else {
          body.steps = steps
            .filter((s) => s.content.trim())
            .map((s, i) =>
              s.sharedStepId
                ? { sharedStepId: s.sharedStepId, sortOrder: i }
                : { content: s.content, expected: s.expected || undefined, sortOrder: i }
            );
        }
        const created = await api<TestCase & { steps?: TestStep[] }>(`/api/sections/${sectionId}/cases`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        navigate(`/cases/${created.id}/edit`, { replace: true });
      } else if (caseId) {
        const stepsPayload = steps
          .filter((s) => s.content.trim())
          .map((s, i) =>
            s.sharedStepId
              ? { sharedStepId: s.sharedStepId, sortOrder: i }
              : { content: s.content, expected: s.expected || undefined, sortOrder: i }
          );
        await api(`/api/cases/${caseId}`, {
          method: "PATCH",
          body: JSON.stringify({ ...body, steps: stepsPayload }),
        });
        navigate(-1);
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
      if (caseId) {
        const list = await api<IssueLink[]>(`/api/cases/${caseId}/issue-links`);
        setIssueLinksList(list);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove link");
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 24 }}>
        <Link to="/projects">Projects</Link> → {isNew ? "New case" : "Edit case"}
      </header>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Title <input value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: "100%" }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>
            Prerequisite <textarea value={prerequisite} onChange={(e) => setPrerequisite(e.target.value)} rows={2} style={{ width: "100%" }} />
          </label>
        </div>
        {caseTypes.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label>
              Case type{" "}
              <select value={caseTypeId} onChange={(e) => setCaseTypeId(e.target.value)}>
                <option value="">— None —</option>
                {caseTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
        )}
        {priorities.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label>
              Priority{" "}
              <select value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
                <option value="">— None —</option>
                {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
        )}
        {datasetsList.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label>
              Dataset (parameterize){" "}
              <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
                <option value="">— None —</option>
                {datasetsList.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.rows?.length ?? 0} rows)</option>)}
              </select>
            </label>
          </div>
        )}
        {caseFields.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h4>Custom fields</h4>
            {caseFields.map((f) => (
              <div key={f.id} style={{ marginBottom: 8 }}>
                <label>
                  {f.name}
                  {f.fieldType === "text" && (
                    <input value={customValues[f.id] ?? ""} onChange={(e) => setCustomValue(f.id, e.target.value)} style={{ width: "100%", marginLeft: 8 }} />
                  )}
                  {f.fieldType === "multiline" && (
                    <textarea value={customValues[f.id] ?? ""} onChange={(e) => setCustomValue(f.id, e.target.value)} rows={2} style={{ width: "100%", marginLeft: 8 }} />
                  )}
                  {f.fieldType === "number" && (
                    <input type="number" value={customValues[f.id] ?? ""} onChange={(e) => setCustomValue(f.id, e.target.value)} style={{ marginLeft: 8 }} />
                  )}
                  {f.fieldType === "dropdown" && (
                    <select value={customValues[f.id] ?? ""} onChange={(e) => setCustomValue(f.id, e.target.value)} style={{ marginLeft: 8 }}>
                      <option value="">—</option>
                      {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </label>
              </div>
            ))}
          </div>
        )}
        <h3>Steps</h3>
        {steps.map((step, i) => (
          <div key={i} style={{ border: "1px solid #ccc", padding: 8, marginBottom: 8 }}>
            {step.sharedStepId && (
              <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Shared step (edit in Project settings)</div>
            )}
            <div>
              <label>Action</label>
              <input
                value={step.content}
                onChange={(e) => updateStep(i, "content", e.target.value)}
                style={{ width: "100%" }}
                readOnly={!!step.sharedStepId}
              />
            </div>
            <div>
              <label>Expected</label>
              <input
                value={step.expected}
                onChange={(e) => updateStep(i, "expected", e.target.value)}
                style={{ width: "100%" }}
                readOnly={!!step.sharedStepId}
              />
            </div>
            <button type="button" onClick={() => removeStep(i)}>Remove</button>
          </div>
        ))}
        <button type="button" onClick={addStep}>Add step</button>
        {sharedStepsList.length > 0 && (
          <span style={{ marginLeft: 8 }}>
            Insert shared step:{" "}
            <select
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (id) {
                  const sh = sharedStepsList.find((s) => s.id === id);
                  if (sh) insertSharedStep(sh);
                  e.target.value = "";
                }
              }}
            >
              <option value="">— Choose —</option>
              {sharedStepsList.map((s) => (
                <option key={s.id} value={s.id}>{s.content.slice(0, 50)}{s.content.length > 50 ? "…" : ""}</option>
              ))}
            </select>
          </span>
        )}
        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>

      {caseId && versions.length > 0 && (
        <section style={{ marginTop: 32, borderTop: "1px solid #ccc", paddingTop: 16 }}>
          <h3>History</h3>
          <ul style={{ listStyle: "none", padding: 0, fontSize: 14 }}>
            {versions.map((v) => (
              <li key={v.id} style={{ marginBottom: 4 }}>
                {new Date(v.createdAt).toLocaleString()} — v {v.id.slice(0, 8)}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 12 }}>
            <label>Compare: </label>
            <select value={diffFrom} onChange={(e) => { setDiffFrom(e.target.value); setDiffResult(null); }}>
              <option value="">— From —</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>{new Date(v.createdAt).toLocaleString()}</option>
              ))}
            </select>
            <select value={diffTo} onChange={(e) => { setDiffTo(e.target.value); setDiffResult(null); }}>
              <option value="">— To —</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>{new Date(v.createdAt).toLocaleString()}</option>
              ))}
            </select>
            <button type="button" onClick={loadDiff} disabled={!diffFrom || !diffTo}>Show diff</button>
          </div>
          {diffResult && (
            <div style={{ marginTop: 12, padding: 12, background: "#f5f5f5", fontSize: 13 }}>
              <strong>Changes:</strong>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                {diffResult.changes.map((c, i) => (
                  <li key={i}>
                    <strong>{c.field}:</strong> {c.old ?? "(empty)"} → {c.new ?? "(empty)"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {caseId && (
        <section style={{ marginTop: 32, borderTop: "1px solid #ccc", paddingTop: 16 }}>
          <h3>Defects / Issues</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {issueLinksList.map((l) => (
              <li key={l.id} style={{ marginBottom: 4 }}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title || l.url}</a>
                <button type="button" style={{ marginLeft: 8 }} onClick={() => removeIssueLink(l.id)}>Remove</button>
              </li>
            ))}
          </ul>
          <form onSubmit={addIssueLink} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <input value={newIssueUrl} onChange={(e) => setNewIssueUrl(e.target.value)} placeholder="URL" style={{ minWidth: 200 }} required />
            <input value={newIssueTitle} onChange={(e) => setNewIssueTitle(e.target.value)} placeholder="Title (optional)" />
            <button type="submit">Add link</button>
          </form>
        </section>
      )}
    </div>
  );
}
