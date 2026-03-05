import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Suite, type Section } from "../api";

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
  if (loading) return <p>Loading…</p>;
  if (error && !suite) return <p style={{ color: "red" }}>{error}</p>;
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
      <div key={section.id} style={{ marginLeft: depth * 16, marginBottom: 4 }}>
        <Link to={`/sections/${section.id}/cases`} style={{ marginRight: 8 }}>{section.name}</Link>
        <Link to={`/sections/${section.id}/cases/new`}>Add case</Link>
        {" · "}
        <button type="button" onClick={() => setAddingUnderParent(section.id)}>Add subsection</button>
        {addingUnderParent === section.id && (
          <form onSubmit={addSubSection} style={{ marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
            <input value={subSectionName} onChange={(e) => setSubSectionName(e.target.value)} placeholder="Section name" />
            <button type="submit" disabled={saving}>Add</button>
            <button type="button" onClick={() => { setAddingUnderParent(null); setSubSectionName(""); }}>Cancel</button>
          </form>
        )}
        {section.children.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {section.children.map((c) => (
              <SectionNode key={c.id} section={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 24 }}>
        <Link to="/projects">Projects</Link> → <Link to={`/projects/${suite.projectId}`}>Project</Link> → <strong>{suite.name}</strong>
      </header>
      <p>
        <Link to={`/suites/${suiteId}/runs/new`}>Create run</Link>
      </p>
      <h2>Sections</h2>
      <form onSubmit={addRootSection} style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <input value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="New section name" style={{ width: 200 }} />
        <button type="submit" disabled={saving}>Add section</button>
      </form>
      {tree.map((s) => (
        <SectionNode key={s.id} section={s} depth={0} />
      ))}
      {tree.length === 0 && !newSectionName && <p>No sections. Add one above.</p>}
    </div>
  );
}
