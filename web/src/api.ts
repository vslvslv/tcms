const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function getToken(): string | null {
  return localStorage.getItem("tcms_token");
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token = getToken(), ...rest } = options;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${path}`, { ...rest, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type User = { id: string; email: string; name: string };
export type Project = { id: string; name: string; description: string | null; userId: string; suiteMode: string; createdAt: string; updatedAt: string };
export type Suite = { id: string; projectId: string; name: string; description: string | null; createdAt: string; updatedAt: string };
export type Section = { id: string; suiteId: string; parentId: string | null; name: string; createdAt: string; updatedAt: string };
export type TestStep = { id: string; testCaseId: string; content: string; expected: string | null; sortOrder: number };
export type TestCase = {
  id: string;
  sectionId: string;
  title: string;
  prerequisite: string | null;
  sortOrder: number;
  caseTypeId?: string | null;
  priorityId?: string | null;
  steps?: TestStep[];
  customFields?: { caseFieldId: string; value: string }[];
};
export type Run = {
  id: string;
  suiteId: string;
  name: string;
  description: string | null;
  planId?: string | null;
  milestoneId?: string | null;
  createdBy: string;
  isCompleted: boolean;
  tests?: RunTest[];
  summary?: { passed: number; failed: number; blocked: number; skipped: number; untested: number };
};
export type Milestone = { id: string; projectId: string; name: string; description: string | null; dueDate: string | null; createdAt: string; updatedAt: string };
export type TestPlan = { id: string; projectId: string; milestoneId: string | null; name: string; description: string | null; createdBy: string; createdAt: string; updatedAt: string };
export type CaseType = { id: string; projectId: string | null; name: string; sortOrder: number };
export type Priority = { id: string; projectId: string | null; name: string; sortOrder: number };
export type ConfigGroup = { id: string; projectId: string; name: string; options?: ConfigOption[] };
export type ConfigOption = { id: string; configGroupId: string; name: string };
export type CaseFieldDefinition = { id: string; projectId: string | null; name: string; fieldType: string; options: string[] | null; sortOrder: number };
export type Role = { id: string; name: string };
export type ProjectMember = { id: string; userId: string; projectId: string; roleId: string; user?: User; role?: Role };
export type RunTest = {
  id: string;
  runId: string;
  testCaseId: string;
  caseTitle: string;
  latestResult: { id: string; status: string; comment: string | null; elapsedSeconds: number | null; createdAt: string } | null;
};
