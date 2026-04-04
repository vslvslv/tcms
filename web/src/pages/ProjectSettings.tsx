import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
  type RequirementsCoverageItem,
  type Webhook,
  type AuditLogEntry,
} from "../api";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { DatasetEditor } from "../components/DatasetEditor";

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
  const navigate = useNavigate();
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
  const [expandedDatasetId, setExpandedDatasetId] = useState<string | null>(null);
  const [requirementsCoverage, setRequirementsCoverage] = useState<RequirementsCoverageItem[]>([]);
  const [webhooksList, setWebhooksList] = useState<Webhook[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [webhookTemplate, setWebhookTemplate] = useState<"custom" | "slack" | "teams">("custom");
  const [saving, setSaving] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"general" | "members" | "case-config" | "integrations" | "danger">("general");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  function load() {
    if (!projectId) return;
    api<{ role: string }>(`/api/projects/${projectId}/my-role`)
      .then((r) => setMyRole(r.role))
      .catch(() => setMyRole(null));
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
      api<RequirementsCoverageItem[]>(`/api/projects/${projectId}/requirements/coverage`),
      api<Webhook[]>(`/api/projects/${projectId}/webhooks`).catch(() => []),
    ])
      .then(([p, ct, pr, cfg, cf, ss, tmpl, ds, r, u, cov, wh]) => {
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
        setRequirementsCoverage(cov ?? []);
        setWebhooksList(Array.isArray(wh) ? wh : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));

    api<ProjectMemberWithDetails[]>(`/api/projects/${projectId}/members`).then(setMembers).catch(() => setMembers([]));
  }

  function loadAuditLog() {
    if (!projectId) return;
    api<AuditLogEntry[]>(`/api/projects/${projectId}/audit-log?limit=50`).then(setAuditLog).catch(() => setAuditLog([]));
  }

  useEffect(() => {
    load();
  }, [projectId]);

  // Auto-load audit log when Danger tab is activated
  useEffect(() => {
    if (activeTab === "danger") loadAuditLog();
  }, [activeTab]);

  async function deleteCaseType(id: string) {
    if (!confirm("Delete this case type?")) return;
    try {
      await api(`/api/projects/${projectId}/case-types/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function deletePriority(id: string) {
    if (!confirm("Delete this priority?")) return;
    try {
      await api(`/api/projects/${projectId}/priorities/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function deleteConfigGroup(id: string) {
    if (!confirm("Delete this config group?")) return;
    try {
      await api(`/api/projects/${projectId}/config-groups/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

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
  if (loading) return <LoadingSpinner />;
  if (error && !project) return <p className="text-error">{error}</p>;
  if (!project) return <p className="text-muted">Project not found</p>;

  const canManage = myRole === "admin" || myRole === "lead";
  const tabs = [
    { key: "general", label: "General" },
    { key: "members", label: "Members" },
    { key: "case-config", label: "Case Config" },
    { key: "integrations", label: "Integrations" },
    ...(canManage ? [{ key: "danger", label: "Danger" }] : []),
  ] as const;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-mono text-xl font-semibold text-text">Settings</h1>
      <p className="mb-5 text-sm text-muted">
        <Link to={`/projects/${projectId}`} className="text-primary hover:underline">← {project.name}</Link>
      </p>
      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px ${activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* General tab */}
      {activeTab === "general" && (
        <div className="flex flex-col gap-6">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Project Info</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!projectId) return;
                setSaving(true);
                try {
                  await api(`/api/projects/${projectId}`, {
                    method: "PATCH",
                    body: JSON.stringify({ name: project.name, description: project.description }),
                  });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed");
                } finally {
                  setSaving(false);
                }
              }}
              className="flex flex-col gap-3"
            >
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">Name</span>
                <input
                  value={project.name}
                  onChange={(e) => setProject((p) => p ? { ...p, name: e.target.value } : p)}
                  className="rounded border border-border bg-surface-raised px-3 py-2 text-text"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">Description</span>
                <textarea
                  value={project.description ?? ""}
                  onChange={(e) => setProject((p) => p ? { ...p, description: e.target.value } : p)}
                  rows={3}
                  className="rounded border border-border bg-surface-raised px-3 py-2 text-text"
                />
              </label>
              <Button type="submit" variant="primary" disabled={saving} className="self-start">Save</Button>
            </form>
          </Card>
        </div>
      )}

      {/* Members tab */}
      {activeTab === "members" && (
        <div className="flex flex-col gap-6">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Members</h2>
            <ul className="mb-4 divide-y divide-border">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1 text-sm text-text">{m.user?.email ?? m.userId}</span>
                  <span className="rounded bg-surface-raised px-2 py-0.5 text-xs text-muted">{m.role?.name ?? m.roleId}</span>
                  {canManage && (
                    <Button variant="secondary" className="text-xs" onClick={() => removeMember(m.userId)}>Remove</Button>
                  )}
                </li>
              ))}
            </ul>
            {canManage && (
              <form onSubmit={addMember} className="flex flex-wrap items-center gap-2">
                <Select value={addMemberUserId} onChange={(e) => setAddMemberUserId(e.target.value)} required>
                  <option value="">Select user</option>
                  {users.filter((u) => !members.some((m) => m.userId === u.id)).map((u) => (
                    <option key={u.id} value={u.id}>{u.email} ({u.name})</option>
                  ))}
                </Select>
                <Select value={addMemberRoleId} onChange={(e) => setAddMemberRoleId(e.target.value)} required>
                  <option value="">Role</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
                <Button type="submit" variant="primary" disabled={saving}>Add member</Button>
              </form>
            )}
          </Card>
        </div>
      )}

      {/* Case Config tab */}
      {activeTab === "case-config" && (
        <div className="flex flex-col gap-6">
          {/* Case Types */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Case Types</h2>
            <form onSubmit={addCaseType} className="mb-3 flex gap-2">
              <input value={newCaseTypeName} onChange={(e) => setNewCaseTypeName(e.target.value)} placeholder="Name" className="flex-1 rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
              <Button type="submit" variant="primary" disabled={saving}>Add</Button>
            </form>
            <ul className="divide-y divide-border">
              {caseTypes.map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-1.5">
                  <span className="flex-1 text-sm text-text">{c.name}</span>
                  <Button variant="secondary" className="text-xs" onClick={() => deleteCaseType(c.id)}>Delete</Button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Priorities */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Priorities</h2>
            <form onSubmit={addPriority} className="mb-3 flex gap-2">
              <input value={newPriorityName} onChange={(e) => setNewPriorityName(e.target.value)} placeholder="Name" className="flex-1 rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
              <Button type="submit" variant="primary" disabled={saving}>Add</Button>
            </form>
            <ul className="divide-y divide-border">
              {priorities.map((p) => (
                <li key={p.id} className="flex items-center gap-2 py-1.5">
                  <span className="flex-1 text-sm text-text">{p.name}</span>
                  <Button variant="secondary" className="text-xs" onClick={() => deletePriority(p.id)}>Delete</Button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Config Groups */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Config Groups</h2>
            <form onSubmit={addConfigGroup} className="mb-3 flex gap-2">
              <input value={newConfigGroupName} onChange={(e) => setNewConfigGroupName(e.target.value)} placeholder="Group name" className="flex-1 rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
              <Button type="submit" variant="primary" disabled={saving}>Add group</Button>
            </form>
            <ul className="divide-y divide-border">
              {configGroups.map((g) => (
                <li key={g.id} className="py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-medium text-text">{g.name}</span>
                    {g.options && g.options.length > 0 && (
                      <span className="text-xs text-muted">({g.options.map((o) => o.name).join(", ")})</span>
                    )}
                    {addingOptionGroupId === g.id ? (
                      <>
                        <input value={newConfigOptionName} onChange={(e) => setNewConfigOptionName(e.target.value)} placeholder="Option" className="rounded border border-border bg-surface-raised px-2 py-1 text-xs text-text w-24" />
                        <Button type="button" variant="primary" className="text-xs" onClick={() => addConfigOption(g.id)} disabled={saving}>Add</Button>
                        <Button type="button" className="text-xs" onClick={() => { setAddingOptionGroupId(null); setNewConfigOptionName(""); }}>Cancel</Button>
                      </>
                    ) : (
                      <Button type="button" variant="secondary" className="text-xs" onClick={() => setAddingOptionGroupId(g.id)}>+ Option</Button>
                    )}
                    <Button variant="secondary" className="text-xs" onClick={() => deleteConfigGroup(g.id)}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Custom Fields */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Case Custom Fields</h2>
            <form onSubmit={addCaseField} className="mb-3 flex flex-wrap gap-2">
              <input value={newCaseFieldName} onChange={(e) => setNewCaseFieldName(e.target.value)} placeholder="Field name" className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
              <Select value={newCaseFieldType} onChange={(e) => setNewCaseFieldType(e.target.value as typeof newCaseFieldType)}>
                <option value="text">Text</option>
                <option value="multiline">Multiline</option>
                <option value="number">Number</option>
                <option value="dropdown">Dropdown</option>
              </Select>
              {newCaseFieldType === "dropdown" && (
                <input value={newCaseFieldOptions} onChange={(e) => setNewCaseFieldOptions(e.target.value)} placeholder="Options (comma-separated)" className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
              )}
              <Button type="submit" variant="primary" disabled={saving}>Add field</Button>
            </form>
            <ul className="divide-y divide-border">
              {caseFields.map((f) => (
                <li key={f.id} className="py-1.5 text-sm text-text">{f.name} <span className="text-muted">({f.fieldType})</span></li>
              ))}
            </ul>
          </Card>

          {/* Case Templates */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Case Templates</h2>
            <p className="mb-3 text-xs text-muted">Create cases from a template with pre-filled steps. One line per step; use " | " to separate action and expected result.</p>
            <form onSubmit={addCaseTemplate} className="mb-3 flex flex-col gap-2">
              <input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Template name" required className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
              <textarea value={newTemplateSteps} onChange={(e) => setNewTemplateSteps(e.target.value)} placeholder={"Step 1 action | expected\nStep 2 action"} rows={4} className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
              <Button type="submit" variant="primary" disabled={saving} className="self-start">Add template</Button>
            </form>
            <ul className="divide-y divide-border">
              {caseTemplates.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-1.5">
                  <span className="flex-1 text-sm text-text">{t.name} <span className="text-muted">({t.templateType})</span></span>
                  <Button variant="secondary" className="text-xs" onClick={() => deleteCaseTemplate(t.id)}>Delete</Button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Datasets */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Datasets</h2>
            <p className="mb-3 text-xs text-muted">Parameterize cases: one test per row when running.</p>
            {expandedDatasetId ? (
              <DatasetEditor datasetId={expandedDatasetId} onBack={() => { setExpandedDatasetId(null); load(); }} />
            ) : (
              <>
                <form onSubmit={addDataset} className="mb-3 flex gap-2">
                  <input value={newDatasetName} onChange={(e) => setNewDatasetName(e.target.value)} placeholder="Dataset name" className="flex-1 rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
                  <Button type="submit" variant="primary" disabled={saving}>Add</Button>
                </form>
                <ul className="divide-y divide-border">
                  {datasetsList.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-2">
                      <span className="flex-1 text-sm font-medium text-text">{d.name}</span>
                      <span className="text-xs text-muted">{d.columns?.length ?? 0} cols, {d.rows?.length ?? 0} rows</span>
                      <Button variant="secondary" className="text-xs" onClick={() => setExpandedDatasetId(d.id)}>Manage</Button>
                      <Button variant="secondary" className="text-xs text-error" onClick={() => deleteDataset(d.id)}>Delete</Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Integrations tab */}
      {activeTab === "integrations" && (
        <div className="flex flex-col gap-6">
          {/* Shared Steps */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Shared Steps</h2>
            <p className="mb-3 text-xs text-muted">Reusable steps you can insert into test cases. Edit once, updates everywhere.</p>
            <form onSubmit={addSharedStep} className="mb-3 flex flex-col gap-2">
              <input value={newSharedContent} onChange={(e) => setNewSharedContent(e.target.value)} placeholder="Action" required className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
              <input value={newSharedExpected} onChange={(e) => setNewSharedExpected(e.target.value)} placeholder="Expected result" className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
              <Button type="submit" variant="primary" disabled={saving} className="self-start">Add step</Button>
            </form>
            <ul className="divide-y divide-border">
              {sharedSteps.map((s) => (
                <li key={s.id} className="py-2">
                  {editingSharedId === s.id ? (
                    <div className="flex flex-col gap-2">
                      <input value={editSharedContent} onChange={(e) => setEditSharedContent(e.target.value)} className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
                      <input value={editSharedExpected} onChange={(e) => setEditSharedExpected(e.target.value)} className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
                      <div className="flex gap-2">
                        <Button variant="primary" className="text-xs" onClick={() => updateSharedStep(s.id)} disabled={saving}>Save</Button>
                        <Button className="text-xs" onClick={() => setEditingSharedId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="flex-1 text-sm text-text">
                        <div><span className="font-medium">Action:</span> {s.content}</div>
                        {s.expected && <div className="text-muted"><span className="font-medium">Expected:</span> {s.expected}</div>}
                      </div>
                      <Button variant="secondary" className="text-xs" onClick={() => { setEditingSharedId(s.id); setEditSharedContent(s.content); setEditSharedExpected(s.expected ?? ""); }}>Edit</Button>
                      <Button variant="secondary" className="text-xs text-error" onClick={() => deleteSharedStep(s.id)}>Delete</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {/* Requirements Coverage */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Requirements Coverage</h2>
            <p className="mb-3 text-xs text-muted">Requirement refs linked to cases (add links in case editor).</p>
            {requirementsCoverage.length === 0 ? (
              <p className="text-sm text-muted">No requirement links yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted">
                    <th className="py-1.5 pr-4">Ref</th>
                    <th className="py-1.5 pr-4">Title</th>
                    <th className="py-1.5 text-right">Cases</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requirementsCoverage.map((row) => (
                    <tr key={row.requirementRef}>
                      <td className="py-1.5 pr-4 text-text">{row.requirementRef}</td>
                      <td className="py-1.5 pr-4 text-muted">{row.title ?? "—"}</td>
                      <td className="py-1.5 text-right text-text">{row.caseCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Webhooks */}
          {canManage && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Webhooks</h2>
              <p className="mb-3 text-xs text-muted">POST to URL on events (case/run/result).</p>
              <ul className="mb-4 divide-y divide-border">
                {webhooksList.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 py-2">
                    <a href={w.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm text-primary hover:underline">{w.url}</a>
                    <span className="text-xs text-muted">{w.events?.join(", ")}</span>
                    <Button variant="secondary" className="text-xs" onClick={async () => {
                      try {
                        await api(`/api/webhooks/${w.id}`, { method: "DELETE" });
                        setWebhooksList((prev) => prev.filter((x) => x.id !== w.id));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Delete failed");
                      }
                    }}>Delete</Button>
                  </li>
                ))}
              </ul>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!projectId || !newWebhookUrl.trim() || newWebhookEvents.length === 0) return;
                  setSaving(true);
                  try {
                    const created = await api<Webhook>(`/api/projects/${projectId}/webhooks`, {
                      method: "POST",
                      body: JSON.stringify({ url: newWebhookUrl.trim(), events: newWebhookEvents }),
                    });
                    setWebhooksList((prev) => [...prev, created]);
                    setNewWebhookUrl("");
                    setNewWebhookEvents([]);
                    setWebhookTemplate("custom");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Add webhook failed");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="flex flex-col gap-3"
              >
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="wh-tpl" checked={webhookTemplate === "custom"} onChange={() => setWebhookTemplate("custom")} /> Custom</label>
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="wh-tpl" checked={webhookTemplate === "slack"} onChange={() => { setWebhookTemplate("slack"); setNewWebhookEvents(["run.completed"]); }} /> Slack</label>
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="wh-tpl" checked={webhookTemplate === "teams"} onChange={() => { setWebhookTemplate("teams"); setNewWebhookEvents(["run.completed"]); }} /> Teams</label>
                </div>
                {webhookTemplate === "slack" && <p className="rounded bg-surface-raised p-2 text-xs text-muted">Paste your Slack incoming webhook URL. On run.completed, TCMS posts a Block Kit message.</p>}
                {webhookTemplate === "teams" && <p className="rounded bg-surface-raised p-2 text-xs text-muted">Paste your Teams connector URL. On run.completed, TCMS posts an Adaptive Card.</p>}
                <input value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} placeholder="https://..." required className="rounded border border-border bg-surface-raised px-3 py-2 text-sm text-text" />
                {webhookTemplate === "custom" && (
                  <div className="flex flex-wrap gap-3 text-sm">
                    {["case.created", "case.updated", "run.created", "run.completed", "result.created"].map((ev) => (
                      <label key={ev} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newWebhookEvents.includes(ev)}
                          onChange={(e) => setNewWebhookEvents((prev) => e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev))}
                        />
                        {ev}
                      </label>
                    ))}
                  </div>
                )}
                <Button type="submit" variant="primary" disabled={saving} className="self-start">Add webhook</Button>
              </form>
            </Card>
          )}
        </div>
      )}

      {/* Danger tab */}
      {activeTab === "danger" && canManage && (
        <div className="flex flex-col gap-6">
          {/* Audit log */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Audit Log</h2>
            <p className="mb-3 text-xs text-muted">Recent activity in this project.</p>
            {auditLog.length === 0 ? (
              <p className="text-sm text-muted">No activity loaded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {auditLog.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{e.action}</span>
                    <span className="text-muted">{e.entityType}</span>
                    <span className="text-muted">·</span>
                    <span className="font-mono text-xs text-muted">{e.entityId.slice(0, 8)}</span>
                    <span className="ml-auto text-xs text-muted">{new Date(e.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Delete project */}
          <Card className="border-error/30 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-error">Delete Project</h2>
            <p className="mb-4 text-sm text-muted">This permanently deletes <span className="font-medium text-text">{project.name}</span> and all its data. This cannot be undone.</p>
            <p className="mb-2 text-sm text-muted">Type <span className="font-mono font-semibold text-text">{project.name}</span> to confirm:</p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={project.name}
              className="mb-3 w-full rounded border border-border bg-surface-raised px-3 py-2 text-sm text-text"
            />
            <Button
              variant="primary"
              disabled={deleteConfirmText !== project.name}
              onClick={async () => {
                if (!projectId || deleteConfirmText !== project.name) return;
                try {
                  await api(`/api/projects/${projectId}`, { method: "DELETE" });
                  navigate("/projects");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Delete failed");
                }
              }}
              className="bg-error text-white hover:bg-error/90 disabled:opacity-40"
            >
              Delete project permanently
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}