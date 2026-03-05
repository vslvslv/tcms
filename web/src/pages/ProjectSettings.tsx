import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import {
  api,
  type Project,
  type CaseType,
  type Priority,
  type ConfigGroup,
  type CaseFieldDefinition,
  type SharedStep,
  type CaseTemplate,
  type Dataset,
  type Role,
  type User,
} from "../api";

type ProjectMemberWithDetails = {
  id: string;
  userId: string;
  projectId: string;
  roleId: string;
  user?: User;
  role?: Role;
};

export default function ProjectSettings() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [configGroups, setConfigGroups] = useState<ConfigGroup[]>([]);
  const [caseFields, setCaseFields] = useState<CaseFieldDefinition[]>([]);
  const [members, setMembers] = useState<ProjectMemberWithDetails[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newCaseTypeName, setNewCaseTypeName] = useState("");
  const [newPriorityName, setNewPriorityName] = useState("");
  const [newConfigGroupName, setNewConfigGroupName] = useState("");
  const [newConfigOptionName, setNewConfigOptionName] = useState("");
  const [addingOptionGroupId, setAddingOptionGroupId] = useState<string | null>(null);
  const [newCaseFieldName, setNewCaseFieldName] = useState("");
  const [newCaseFieldType, setNewCaseFieldType] = useState<"text" | "dropdown" | "number" | "multiline">("text");
  const [newCaseFieldOptions, setNewCaseFieldOptions] = useState("");
  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [addMemberRoleId, setAddMemberRoleId] = useState("");
  const [sharedSteps, setSharedSteps] = useState<SharedStep[]>([]);
  const [newSharedContent, setNewSharedContent] = useState("");
  const [newSharedExpected, setNewSharedExpected] = useState("");
  const [editingSharedId, setEditingSharedId] = useState<string | null>(null);
  const [editSharedContent, setEditSharedContent] = useState("");
  const [editSharedExpected, setEditSharedExpected] = useState("");
  const [caseTemplates, setCaseTemplates] = useState<CaseTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateSteps, setNewTemplateSteps] = useState("");
  const [datasetsList, setDatasetsList] = useState<Dataset[]>([]);
  const [newDatasetName, setNewDatasetName] = useState("");
  const [newRowData, setNewRowData] = useState("");
  const [addingRowDatasetId, setAddingRowDatasetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    if (!projectId) return;
    Promise.all([
      api<Project>(`/api/projects/${projectId}`),
      api<CaseType[]>(`/api/projects/${projectId}/case-types`),
      api<Priority[]>(`/api/projects/${projectId}/priorities`),
      api<ConfigGroup[]>(`/api/projects/${projectId}/config-groups`),
      api<CaseFieldDefinition[]>(`/api/projects/${projectId}/case-fields`),
      api<SharedStep[]>(`/api/projects/${projectId}/shared-steps`),
      api<CaseTemplate[]>(`/api/projects/${projectId}/case-templates`),
      api<Dataset[]>(`/api/projects/${projectId}/datasets`),
      api<Role[]>(`/api/roles`),
      api<User[]>(`/api/users`),
    ])
      .then(([p, ct, pr, cfg, cf, ss, tmpl, ds, r, u]) => {
        setProject(p);
        setCaseTypes(ct);
        setPriorities(pr);
        setConfigGroups(cfg);
        setCaseFields(cf);
        setSharedSteps(ss);
        setCaseTemplates(tmpl);
        setDatasetsList(ds);
        setRoles(r);
        setUsers(u);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));

    api<ProjectMemberWithDetails[]>(`/api/projects/${projectId}/members`).then(setMembers).catch(() => setMembers([]));
  }

  useEffect(() => {
    load();
  }, [projectId]);

  async function addCaseType(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !newCaseTypeName.trim()) return;
    setSaving(true);
    try {
      await api<CaseType>(`/api/projects/${projectId}/case-types`, {
        method: "POST",
        body: JSON.stringify({ name: newCaseTypeName.trim() }),
      });
      setNewCaseTypeName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function addPriority(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !newPriorityName.trim()) return;
    setSaving(true);
    try {
      await api<Priority>(`/api/projects/${projectId}/priorities`, {
        method: "POST",
        body: JSON.stringify({ name: newPriorityName.trim() }),
      });
      setNewPriorityName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function addConfigGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !newConfigGroupName.trim()) return;
    setSaving(true);
    try {
      await api<ConfigGroup>(`/api/projects/${projectId}/config-groups`, {
        method: "POST",
        body: JSON.stringify({ name: newConfigGroupName.trim() }),
      });
      setNewConfigGroupName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function addConfigOption(groupId: string) {
    if (!newConfigOptionName.trim()) return;
    setSaving(true);
    try {
      await api(`/api/config-groups/${groupId}/options`, {
        method: "POST",
        body: JSON.stringify({ name: newConfigOptionName.trim() }),
      });
      setNewConfigOptionName("");
      setAddingOptionGroupId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function addCaseField(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !newCaseFieldName.trim()) return;
    setSaving(true);
    try {
      const options =
        newCaseFieldType === "dropdown" && newCaseFieldOptions.trim()
          ? newCaseFieldOptions.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined;
      await api<CaseFieldDefinition>(`/api/projects/${projectId}/case-fields`, {
        method: "POST",
        body: JSON.stringify({
          name: newCaseFieldName.trim(),
          fieldType: newCaseFieldType,
          options: options ?? undefined,
        }),
      });
      setNewCaseFieldName("");
      setNewCaseFieldOptions("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !addMemberUserId || !addMemberRoleId) return;
    setSaving(true);
    try {
      await api(`/api/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId: addMemberUserId, roleId: addMemberRoleId }),
      });
      setAddMemberUserId("");
      setAddMemberRoleId("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(userId: string) {
    if (!projectId) return;
    if (!confirm("Remove this member?")) return;
    setSaving(true);
    try {
      await api(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function addSharedStep(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !newSharedContent.trim()) return;
    setSaving(true);
    try {
      await api<SharedStep>(`/api/projects/${projectId}/shared-steps`, {
        method: "POST",
        body: JSON.stringify({ content: newSharedContent.trim(), expected: newSharedExpected.trim() || undefined }),
      });
      setNewSharedContent("");
      setNewSharedExpected("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function updateSharedStep(id: string) {
    setSaving(true);
    try {
      await api<SharedStep>(`/api/shared-steps/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: editSharedContent, expected: editSharedExpected || null }),
      });
      setEditingSharedId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSharedStep(id: string) {
    if (!confirm("Delete this shared step? Cases will keep a copy as inline.")) return;
    setSaving(true);
    try {
      await api(`/api/shared-steps/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function addCaseTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !newTemplateName.trim()) return;
    const defaultSteps = newTemplateSteps
      .trim()
      .split("\n")
      .filter((l) => l.trim())
      .map((line, i) => {
        const [content, expected] = line.includes("|") ? line.split("|").map((s) => s.trim()) : [line.trim(), null];
        return { content: content || "", expected: expected ?? null, sortOrder: i };
      });
    setSaving(true);
    try {
      await api<CaseTemplate>(`/api/projects/${projectId}/case-templates`, {
        method: "POST",
        body: JSON.stringify({ name: newTemplateName.trim(), templateType: "steps_based", defaultSteps }),
      });
      setNewTemplateName("");
      setNewTemplateSteps("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCaseTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    setSaving(true);
    try {
      await api(`/api/case-templates/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function addDataset(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !newDatasetName.trim()) return;
    setSaving(true);
    try {
      await api<Dataset>(`/api/projects/${projectId}/datasets`, {
        method: "POST",
        body: JSON.stringify({ name: newDatasetName.trim() }),
      });
      setNewDatasetName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function addDatasetRow(datasetId: string) {
    let data: Record<string, string> = {};
    try {
      data = JSON.parse(newRowData || "{}");
    } catch {
      setError("Invalid JSON for row data");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/datasets/${datasetId}/rows`, { method: "POST", body: JSON.stringify({ data }) });
      setNewRowData("");
      setAddingRowDatasetId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDataset(id: string) {
    if (!confirm("Delete this dataset?")) return;
    setSaving(true);
    try {
      await api(`/api/datasets/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (!projectId) return null;
  if (loading) return <p>Loading…</p>;
  if (error && !project) return <p style={{ color: "red" }}>{error}</p>;
  if (!project) return <p>Project not found</p>;

  const isOwner = project.userId === user?.id;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 24 }}>
        <Link to="/projects">Projects</Link> → <Link to={`/projects/${projectId}`}>{project.name}</Link> → <strong>Settings</strong>
      </header>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <section style={{ marginBottom: 32 }}>
        <h3>Case types</h3>
        <form onSubmit={addCaseType} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={newCaseTypeName} onChange={(e) => setNewCaseTypeName(e.target.value)} placeholder="Name" />
          <button type="submit" disabled={saving}>Add</button>
        </form>
        <ul style={{ listStyle: "none", padding: 0 }}>{caseTypes.map((c) => <li key={c.id}>{c.name}</li>)}</ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3>Shared steps</h3>
        <p style={{ fontSize: 12, color: "#666" }}>Reusable steps you can insert into test cases. Edit once, updates everywhere.</p>
        <form onSubmit={addSharedStep} style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>
            <input value={newSharedContent} onChange={(e) => setNewSharedContent(e.target.value)} placeholder="Action" style={{ width: "100%" }} required />
          </div>
          <div style={{ marginBottom: 4 }}>
            <input value={newSharedExpected} onChange={(e) => setNewSharedExpected(e.target.value)} placeholder="Expected result" style={{ width: "100%" }} />
          </div>
          <button type="submit" disabled={saving}>Add shared step</button>
        </form>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {sharedSteps.map((s) => (
            <li key={s.id} style={{ border: "1px solid #eee", padding: 8, marginBottom: 8 }}>
              {editingSharedId === s.id ? (
                <>
                  <input value={editSharedContent} onChange={(e) => setEditSharedContent(e.target.value)} style={{ width: "100%", marginBottom: 4 }} />
                  <input value={editSharedExpected} onChange={(e) => setEditSharedExpected(e.target.value)} style={{ width: "100%", marginBottom: 4 }} />
                  <button type="button" onClick={() => updateSharedStep(s.id)} disabled={saving}>Save</button>
                  <button type="button" onClick={() => { setEditingSharedId(null); }}>Cancel</button>
                </>
              ) : (
                <>
                  <div><strong>Action:</strong> {s.content}</div>
                  {s.expected && <div><strong>Expected:</strong> {s.expected}</div>}
                  <button type="button" style={{ marginRight: 8 }} onClick={() => { setEditingSharedId(s.id); setEditSharedContent(s.content); setEditSharedExpected(s.expected ?? ""); }}>Edit</button>
                  <button type="button" onClick={() => deleteSharedStep(s.id)}>Delete</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3>Case templates</h3>
        <p style={{ fontSize: 12, color: "#666" }}>Create cases from a template with pre-filled steps. One line per step; use " | " to separate action and expected result.</p>
        <form onSubmit={addCaseTemplate} style={{ marginBottom: 12 }}>
          <input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Template name" style={{ width: "100%", marginBottom: 4 }} required />
          <textarea value={newTemplateSteps} onChange={(e) => setNewTemplateSteps(e.target.value)} placeholder="Step 1 action | expected&#10;Step 2 action" rows={4} style={{ width: "100%", marginBottom: 4 }} />
          <button type="submit" disabled={saving}>Add template</button>
        </form>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {caseTemplates.map((t) => (
            <li key={t.id} style={{ marginBottom: 8 }}>
              {t.name} ({t.templateType})
              <button type="button" style={{ marginLeft: 8 }} onClick={() => deleteCaseTemplate(t.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3>Datasets</h3>
        <p style={{ fontSize: 12, color: "#666" }}>Parameterize cases: one test per row when running. Add rows as JSON.</p>
        <form onSubmit={addDataset} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={newDatasetName} onChange={(e) => setNewDatasetName(e.target.value)} placeholder="Dataset name" />
          <button type="submit" disabled={saving}>Add dataset</button>
        </form>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {datasetsList.map((d) => (
            <li key={d.id} style={{ marginBottom: 12, padding: 8, border: "1px solid #eee" }}>
              <strong>{d.name}</strong>
              <button type="button" style={{ marginLeft: 8 }} onClick={() => deleteDataset(d.id)}>Delete</button>
              <div style={{ fontSize: 12, marginTop: 4 }}>Rows: {d.rows?.length ?? 0}</div>
              {addingRowDatasetId === d.id ? (
                <div style={{ marginTop: 8 }}>
                  <input value={newRowData} onChange={(e) => setNewRowData(e.target.value)} placeholder='{"Browser":"Chrome"}' style={{ width: 200 }} />
                  <button type="button" onClick={() => addDatasetRow(d.id)} disabled={saving}>Add row</button>
                  <button type="button" onClick={() => { setAddingRowDatasetId(null); setNewRowData(""); }}>Cancel</button>
                </div>
              ) : (
                <button type="button" style={{ marginTop: 4 }} onClick={() => setAddingRowDatasetId(d.id)}>+ Add row</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3>Priorities</h3>
        <form onSubmit={addPriority} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={newPriorityName} onChange={(e) => setNewPriorityName(e.target.value)} placeholder="Name" />
          <button type="submit" disabled={saving}>Add</button>
        </form>
        <ul style={{ listStyle: "none", padding: 0 }}>{priorities.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3>Config groups</h3>
        <form onSubmit={addConfigGroup} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={newConfigGroupName} onChange={(e) => setNewConfigGroupName(e.target.value)} placeholder="Group name" />
          <button type="submit" disabled={saving}>Add group</button>
        </form>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {configGroups.map((g) => (
            <li key={g.id} style={{ marginBottom: 8 }}>
              <strong>{g.name}</strong>
              {g.options && g.options.length > 0 && (
                <span style={{ marginLeft: 8 }}>({g.options.map((o) => o.name).join(", ")})</span>
              )}
              {addingOptionGroupId === g.id ? (
                <span style={{ marginLeft: 8 }}>
                  <input value={newConfigOptionName} onChange={(e) => setNewConfigOptionName(e.target.value)} placeholder="Option name" size={12} />
                  <button type="button" onClick={() => addConfigOption(g.id)} disabled={saving}>Add</button>
                  <button type="button" onClick={() => { setAddingOptionGroupId(null); setNewConfigOptionName(""); }}>Cancel</button>
                </span>
              ) : (
                <button type="button" style={{ marginLeft: 8 }} onClick={() => setAddingOptionGroupId(g.id)}>+ Option</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3>Case custom fields</h3>
        <form onSubmit={addCaseField} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <input value={newCaseFieldName} onChange={(e) => setNewCaseFieldName(e.target.value)} placeholder="Field name" />
            <select value={newCaseFieldType} onChange={(e) => setNewCaseFieldType(e.target.value as typeof newCaseFieldType)}>
              <option value="text">Text</option>
              <option value="multiline">Multiline</option>
              <option value="number">Number</option>
              <option value="dropdown">Dropdown</option>
            </select>
            {newCaseFieldType === "dropdown" && (
              <input value={newCaseFieldOptions} onChange={(e) => setNewCaseFieldOptions(e.target.value)} placeholder="Options (comma-separated)" size={24} />
            )}
            <button type="submit" disabled={saving}>Add field</button>
          </div>
        </form>
        <ul style={{ listStyle: "none", padding: 0 }}>{caseFields.map((f) => <li key={f.id}>{f.name} ({f.fieldType})</li>)}</ul>
      </section>

      {isOwner && (
        <section style={{ marginBottom: 32 }}>
          <h3>Project members</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {members.map((m) => (
              <li key={m.id} style={{ marginBottom: 4 }}>
                {m.user?.email ?? m.userId} — {m.role?.name ?? m.roleId}
                <button type="button" style={{ marginLeft: 8 }} onClick={() => removeMember(m.userId)}>Remove</button>
              </li>
            ))}
          </ul>
          <form onSubmit={addMember} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}>
            <select value={addMemberUserId} onChange={(e) => setAddMemberUserId(e.target.value)} required>
              <option value="">Select user</option>
              {users.filter((u) => !members.some((m) => m.userId === u.id)).map((u) => (
                <option key={u.id} value={u.id}>{u.email} ({u.name})</option>
              ))}
            </select>
            <select value={addMemberRoleId} onChange={(e) => setAddMemberRoleId(e.target.value)} required>
              <option value="">Role</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button type="submit" disabled={saving}>Add member</button>
          </form>
        </section>
      )}
    </div>
  );
}
