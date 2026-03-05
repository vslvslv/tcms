import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type TestCase, type TestStep } from "../api";

export default function CaseEditor() {
  const { caseId, sectionId } = useParams<{ caseId?: string; sectionId?: string }>();
  const navigate = useNavigate();
  const isNew = !caseId;
  const [title, setTitle] = useState("");
  const [prerequisite, setPrerequisite] = useState("");
  const [steps, setSteps] = useState<{ content: string; expected: string }[]>([{ content: "", expected: "" }]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (caseId) {
      api<TestCase & { steps?: TestStep[] }>(`/api/cases/${caseId}`)
        .then((c) => {
          setTitle(c.title);
          setPrerequisite(c.prerequisite ?? "");
          setSteps(
            c.steps && c.steps.length > 0
              ? c.steps.map((s) => ({ content: s.content, expected: s.expected ?? "" }))
              : [{ content: "", expected: "" }]
          );
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
        .finally(() => setLoading(false));
    }
  }, [caseId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const stepsPayload = steps.filter((s) => s.content.trim()).map((s) => ({ content: s.content, expected: s.expected || undefined }));
      if (isNew && sectionId) {
        const created = await api<TestCase & { steps?: TestStep[] }>(`/api/sections/${sectionId}/cases`, {
          method: "POST",
          body: JSON.stringify({ title, prerequisite: prerequisite || undefined, steps: stepsPayload }),
        });
        navigate(`/cases/${created.id}/edit`, { replace: true });
      } else if (caseId) {
        await api(`/api/cases/${caseId}`, {
          method: "PATCH",
          body: JSON.stringify({ title, prerequisite: prerequisite || undefined, steps: stepsPayload }),
        });
        navigate(-1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
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

  if (!isNew && loading) return <p>Loading…</p>;

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
