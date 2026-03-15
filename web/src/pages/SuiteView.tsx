import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Suite, type Section } from "../api";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

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
        <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={() => setAddingUnderParent(section.id)}>Add subsection</button>
        {addingUnderParent === section.id && (
          <form onSubmit={addSubSection} className="mt-2 flex flex-wrap items-center gap-2">
            <input value={subSectionName} onChange={(e) => setSubSectionName(e.target.value)} placeholder="Section name" className="rounded border border-input px-2 py-1 text-sm" />
            <button type="submit" disabled={saving} className="rounded border border-primary bg-primary px-2 py-1 text-sm text-white hover:bg-primary-hover disabled:opacity-50">Add</button>
            <button type="button" className="rounded border border-input px-2 py-1 text-sm hover:bg-accent" onClick={() => { setAddingUnderParent(null); setSubSectionName(""); }}>Cancel</button>
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
      <h1 className="mb-2 text-xl font-semibold text-foreground">{suite.name}</h1>
      <p className="mb-6">
        <Link to={`/suites/${suiteId}/runs/new`} className="text-primary hover:underline">Create run</Link>
      </p>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sections</h2>
      <form onSubmit={addRootSection} className="mb-6 flex items-center gap-2">
        <input value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="New section name" className="w-48 rounded border border-input px-2 py-1.5 text-sm" />
        <button type="submit" disabled={saving} className="rounded border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50">Add section</button>
      </form>
      <div className="rounded-lg border border-border bg-surface p-4">
        {tree.map((s) => (
          <SectionNode key={s.id} section={s} depth={0} />
        ))}
        {tree.length === 0 && !newSectionName && <p className="text-muted-foreground">No sections. Add one above.</p>}
      </div>
    </div>
  );
}
