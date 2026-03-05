import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type TestCase, type TestStep, type CaseType, type Priority, type CaseFieldDefinition, type Suite, type Section } from "../api";

export default function CaseEditor() {
  const { caseId, sectionId } = useParams<{ caseId?: string; sectionId?: string }>();
  const navigate = useNavigate();
  const isNew = !caseId;
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [caseFields, setCaseFields] = useState<CaseFieldDefinition[]>([]);
  const [title, setTitle] = useState("");
  const [prerequisite, setPrerequisite] = useState("");
  const [caseTypeId, setCaseTypeId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [steps, setSteps] = useState<{ content: string; expected: string }[]>([{ content: "", expected: "" }]);
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
        setSteps(
          c.steps && c.steps.length > 0
            ? c.steps.map((s) => ({ content: s.content, expected: s.expected ?? "" }))
            : [{ content: "", expected: "" }]
        );
        const byField = (c.customFields ?? []).reduce<Record<string, string>>((acc, f) => {
          acc[f.caseFieldId] = f.value;
          return acc;
        }, {});
        setCustomValues(byField);
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
        ]).then(([ct, pr, cf]) => {
          if (cancelled) return;
          setCaseTypes(ct);
          setPriorities(pr);
          setCaseFields(cf);
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
      const stepsPayload = steps.filter((s) => s.content.trim()).map((s) => ({ content: s.content, expected: s.expected || undefined }));
      const body = {
        title,
        prerequisite: prerequisite || undefined,
        steps: stepsPayload,
        caseTypeId: caseTypeId || null,
        priorityId: priorityId || null,
        customFields: customFieldsPayload.length > 0 ? customFieldsPayload : undefined,
      };
      if (isNew && sectionId) {
        const created = await api<TestCase & { steps?: TestStep[] }>(`/api/sections/${sectionId}/cases`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        navigate(`/cases/${created.id}/edit`, { replace: true });
      } else if (caseId) {
        await api(`/api/cases/${caseId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
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
  function removeStep(i: number) {
    setSteps((s) => s.filter((_, idx) => idx !== i));
  }
  function updateStep(i: number, field: "content" | "expected", value: string) {
    setSteps((s) => s.map((step, idx) => (idx === i ? { ...step, [field]: value } : step)));
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
            <div>
              <label>Action</label>
              <input value={step.content} onChange={(e) => updateStep(i, "content", e.target.value)} style={{ width: "100%" }} />
            </div>
            <div>
              <label>Expected</label>
              <input value={step.expected} onChange={(e) => updateStep(i, "expected", e.target.value)} style={{ width: "100%" }} />
            </div>
            <button type="button" onClick={() => removeStep(i)}>Remove</button>
          </div>
        ))}
        <button type="button" onClick={addStep}>Add step</button>
        <div style={{ marginTop: 16 }}>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}
