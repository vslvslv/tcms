import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Suite, type Section, type AiFailureResult } from "../api";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { CaseSearchBar } from "../components/CaseSearchBar";
import { Select } from "../components/ui/Select";

function buildTree(sections: Section[]): (Section & { children: ReturnType<typeof buildTree> })[] {
  const byParent = new Map<string | null, Section[]>();
  for (const s of sections) {
    const key = s.parentId ?? "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(s);
  }
  function children(parentId: string | null): (Section & { children: ReturnType<typeof children> })[] {
    const list = byParent.get(parentId ?? "root") ?? [];
    return list.map((s) => ({ ...s, children: children(s.id) }));
  }
  return children(null);
}

type AiModalState = { sectionId: string; sectionName: string } | null;

export default function SuiteView() {
  const { suiteId } = useParams<{ suiteId: string }>();
  const [suite, setSuite] = useState<Suite | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [addingUnderParent, setAddingUnderParent] = useState<string | null>(null);
  const [subSectionName, setSubSectionName] = useState("");
  const [saving, setSaving] = useState(false);

  // AI generation modal
  const [aiModal, setAiModal] = useState<AiModalState>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiWorking, setAiWorking] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState<{ created: number } | null>(null);

  // CI failure panel
  const [ciOpen, setCiOpen] = useState(false);
  const [ciLog, setCiLog] = useState("");
  const [ciContext, setCiContext] = useState("");
  const [ciSectionId, setCiSectionId] = useState("");
  const [ciWorking, setCiWorking] = useState(false);
  const [ciError, setCiError] = useState("");
  const [ciResult, setCiResult] = useState<AiFailureResult | null>(null);

  function load() {
    if (!suiteId) return;
    Promise.all([
      api<Suite>(`/api/suites/${suiteId}`),
      api<Section[]>(`/api/suites/${suiteId}/sections`),
    ])
      .then(([s, sec]) => {
        setSuite(s);
        setSections(sec);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [suiteId]);

  async function addRootSection(e: React.FormEvent) {
    e.preventDefault();
    if (!suiteId || !newSectionName.trim()) return;
    setSaving(true);
    try {
      await api(`/api/suites/${suiteId}/sections`, {
        method: "POST",
        body: JSON.stringify({ name: newSectionName.trim() }),
      });
      setNewSectionName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add section");
    } finally {
      setSaving(false);
    }
  }

  async function addSubSection(e: React.FormEvent) {
    e.preventDefault();
    if (!addingUnderParent || !subSectionName.trim()) return;
    setSaving(true);
    try {
      await api(`/api/sections/${addingUnderParent}/sections`, {
        method: "POST",
        body: JSON.stringify({ name: subSectionName.trim() }),
      });
      setSubSectionName("");
      setAddingUnderParent(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add section");
    } finally {
      setSaving(false);
    }
  }

  function openAiModal(sectionId: string, sectionName: string) {
    setAiModal({ sectionId, sectionName });
    setAiPrompt("");
    setAiCount(5);
    setAiError("");
    setAiResult(null);
  }

  function closeAiModal() {
    setAiModal(null);
    setAiError("");
    setAiResult(null);
  }

  async function handleAiGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!aiModal || !suite) return;
    setAiWorking(true);
    setAiError("");
    setAiResult(null);
    try {
      const result = await api<{ created: number }>(`/api/projects/${suite.projectId}/ai/generate-cases`, {
        method: "POST",
        body: JSON.stringify({
          sectionId: aiModal.sectionId,
          prompt: aiPrompt.trim(),
          count: aiCount,
        }),
      });
      setAiResult(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAiWorking(false);
    }
  }

  async function handleCiGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!suite || !ciLog.trim()) return;
    setCiWorking(true);
    setCiError("");
    setCiResult(null);
    try {
      const result = await api<AiFailureResult>(`/api/projects/${suite.projectId}/generate-from-failure`, {
        method: "POST",
        body: JSON.stringify({
          failureLog: ciLog.trim(),
          context: ciContext.trim() || undefined,
          sectionId: ciSectionId || undefined,
        }),
      });
      setCiResult(result);
    } catch (err) {
      setCiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setCiWorking(false);
    }
  }

  if (!suiteId) return null;
  if (loading) return <LoadingSpinner />;
  if (error && !suite) return <p className="text-error">{error}</p>;
  if (!suite) return null;

  const tree = buildTree(sections);

  type SectionWithChildren = Section & { children: SectionWithChildren[] };
  function SectionNode({
    section,
    depth,
  }: {
    section: SectionWithChildren;
    depth: number;
  }) {
    return (
      <div key={section.id} className="mb-1" style={{ marginLeft: depth * 16 }}>
        <Link to={`/sections/${section.id}/cases`} className="mr-2 font-medium text-primary hover:underline">{section.name}</Link>
        <Link to={`/sections/${section.id}/cases/new`} className="text-sm text-primary hover:underline">Add case</Link>
        {" · "}
        <button type="button" className="text-sm text-muted hover:underline" onClick={() => setAddingUnderParent(section.id)}>Add subsection</button>
        {" · "}
        <button
          type="button"
          className="text-sm text-primary hover:underline"
          onClick={() => openAiModal(section.id, section.name)}
        >
          Generate with AI
        </button>
        {addingUnderParent === section.id && (
          <form onSubmit={addSubSection} className="mt-2 flex flex-wrap items-center gap-2">
            <input value={subSectionName} onChange={(e) => setSubSectionName(e.target.value)} placeholder="Section name" className="rounded border border-border bg-surface-raised text-text px-2 py-1 text-sm" />
            <button type="submit" disabled={saving} className="rounded border border-primary bg-primary px-2 py-1 text-sm text-white hover:bg-primary-hover disabled:opacity-50">Add</button>
            <button type="button" className="rounded border border-border bg-surface-raised px-2 py-1 text-sm hover:bg-surface-raised" onClick={() => { setAddingUnderParent(null); setSubSectionName(""); }}>Cancel</button>
          </form>
        )}
        {section.children.length > 0 && (
          <div className="mt-1">
            {section.children.map((c) => (
              <SectionNode key={c.id} section={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-xl font-semibold text-text font-mono">{suite.name}</h1>
      <p className="mb-4">
        <Link to={`/suites/${suiteId}/runs/new`} className="text-primary hover:underline">Create run</Link>
      </p>
      <CaseSearchBar projectId={suite.projectId} />
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Sections</h2>

      {/* Generate from CI failure panel */}
      <div className="mb-6 rounded border border-border bg-surface">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-text hover:bg-surface-raised"
          onClick={() => { setCiOpen((v) => !v); setCiResult(null); setCiError(""); }}
          aria-expanded={ciOpen}
        >
          <span>Generate test cases from CI failure</span>
          <span className="text-muted">{ciOpen ? "▲" : "▼"}</span>
        </button>
        {ciOpen && (
          <div className="border-t border-border px-4 pb-4 pt-3">
            {ciResult ? (
              <div className="space-y-3">
                <p className="text-sm text-success">
                  {ciResult.created > 0
                    ? `Created ${ciResult.created} test case${ciResult.created !== 1 ? "s" : ""} in the selected section.`
                    : `Found ${ciResult.suggestions.length} suggestion${ciResult.suggestions.length !== 1 ? "s" : ""}.`}
                </p>
                <div className="space-y-2">
                  {ciResult.suggestions.map((s, i) => (
                    <div key={i} className="rounded border border-border bg-surface-raised p-3 text-sm">
                      <div className="font-medium text-text">{s.title}</div>
                      <div className="mt-1 text-xs text-muted">{s.reasoning}</div>
                      <div className="mt-2 space-y-1">
                        {s.steps.map((step, j) => (
                          <div key={j} className="flex gap-2 text-xs text-muted">
                            <span className="shrink-0 w-4">{j + 1}.</span>
                            <span>{step.content}{step.expected ? ` → ${step.expected}` : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="secondary" onClick={() => setCiResult(null)}>Try another failure</Button>
              </div>
            ) : (
              <form onSubmit={handleCiGenerate} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">CI failure log (paste stack trace, error output, or test failure message)</label>
                  <textarea
                    value={ciLog}
                    onChange={(e) => setCiLog(e.target.value)}
                    rows={6}
                    required
                    placeholder={"FAIL src/auth/login.test.ts\n  ● Login › should reject invalid password\n    expect(received).toBe(expected)\n    Expected: 401\n    Received: 200"}
                    className="w-full rounded border border-border bg-surface-raised text-text px-2 py-1.5 font-mono text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Additional context (optional — ticket description, PR summary)</label>
                  <textarea
                    value={ciContext}
                    onChange={(e) => setCiContext(e.target.value)}
                    rows={2}
                    placeholder="e.g. Auth refactor PR — moved session validation to middleware layer"
                    className="w-full rounded border border-border bg-surface-raised text-text px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Insert into section (optional)</label>
                  <Select value={ciSectionId} onChange={(e) => setCiSectionId(e.target.value)} className="w-full text-sm">
                    <option value="">— Suggestions only, don&apos;t insert —</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>
                {ciError && <p className="text-sm text-error">{ciError}</p>}
                <Button type="submit" variant="primary" disabled={ciWorking || !ciLog.trim()}>
                  {ciWorking ? "Analyzing…" : "Generate test cases"}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      <form onSubmit={addRootSection} className="mb-6 flex items-center gap-2">
        <input value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="New section name" className="w-48 rounded border border-border bg-surface-raised text-text px-2 py-1.5 text-sm" />
        <button type="submit" disabled={saving} className="rounded border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50">Add section</button>
      </form>
      <div className="rounded-lg border border-border bg-surface p-4">
        {tree.map((s) => (
          <SectionNode key={s.id} section={s} depth={0} />
        ))}
        {tree.length === 0 && !newSectionName && <p className="text-muted">No sections. Add one above.</p>}
      </div>

      {/* AI Generation Modal */}
      <Modal isOpen={!!aiModal} onClose={closeAiModal} title={`Generate test cases — ${aiModal?.sectionName ?? ""}`}>
        {aiResult ? (
          <div className="space-y-4">
            <p className="text-success">
              Generated {aiResult.created} test case{aiResult.created !== 1 ? "s" : ""} in &quot;{aiModal?.sectionName}&quot;.
            </p>
            <p className="text-sm text-muted">
              <Link to={`/sections/${aiModal?.sectionId}/cases`} className="text-primary hover:underline" onClick={closeAiModal}>
                View cases &rarr;
              </Link>
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setAiResult(null)}>Generate more</Button>
              <Button variant="primary" onClick={closeAiModal}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAiGenerate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">
                Describe what to test
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={4}
                required
                placeholder="e.g. Login flow with valid and invalid credentials, password reset, session timeout"
                className="w-full rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">
                Number of cases (1–20)
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={aiCount}
                onChange={(e) => setAiCount(Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                className="w-24 rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {aiError && <p className="text-sm text-error">{aiError}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={aiWorking || !aiPrompt.trim()}>
                {aiWorking ? "Generating..." : "Generate"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeAiModal} disabled={aiWorking}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
