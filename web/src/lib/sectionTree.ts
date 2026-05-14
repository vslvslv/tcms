import { type Section } from "../api";

export type SectionNode = Section & { children: SectionNode[] };

/**
 * Build a recursive section tree from a flat list.
 * Used by CasesOverview (three-panel layout) and CasesDetails.
 */
export function buildSectionTree(sections: Section[]): SectionNode[] {
  const byParent = new Map<string | null, Section[]>();
  for (const s of sections) {
    const key = s.parentId ?? "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(s);
  }
  function children(parentId: string | null): SectionNode[] {
    const list = byParent.get(parentId ?? "root") ?? [];
    return list.map((s) => ({ ...s, children: children(s.id) }));
  }
  return children(null);
}
