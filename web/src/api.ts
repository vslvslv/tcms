const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function getToken(): string | null {
  return localStorage.getItem("tcms_token");
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token = getToken(), ...rest } = options;
  const hasBody = rest.body !== undefined && rest.body !== null;
  const headers: HeadersInit = {
    ...(hasBody && { "Content-Type": "application/json" }),
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
export type TestStep = {
  id: string;
  testCaseId: string;
  content: string;
  expected: string | null;
  sortOrder: number;
  sharedStepId?: string;
};
export type SharedStep = { id: string; projectId: string; content: string; expected: string | null; sortOrder: number; createdAt: string; updatedAt: string };
export type TestCase = {
  id: string;
  sectionId: string;
  title: string;
  prerequisite: string | null;
  sortOrder: number;
  caseTypeId?: string | null;
  priorityId?: string | null;
  status?: "draft" | "ready" | "approved";
  approvedById?: string | null;
  approvedAt?: string | null;
  steps?: TestStep[];
  customFields?: { caseFieldId: string; value: string }[];
};
export type CaseSummary = { total: number; draft: number; ready: number; approved: number };
export type Run = {
  id: string;
  suiteId: string;
  name: string;
  description: string | null;
  planId?: string | null;
  milestoneId?: string | null;
  createdBy: string;
  isCompleted: boolean;
  createdAt?: string;
  updatedAt?: string;
  tests?: RunTest[];
  summary?: { passed: number; failed: number; blocked: number; skipped: number; untested: number };
};
/** Run list item from GET /api/projects/:projectId/runs */
export type ProjectRun = Run & {
  suiteName: string | null;
  createdByName: string | null;
  planName: string | null;
  milestoneName: string | null;
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
export type CaseTemplate = {
  id: string;
  projectId: string;
  name: string;
  templateType: string;
  defaultSteps: { content: string; expected: string | null; sortOrder: number }[] | null;
  createdAt: string;
  updatedAt: string;
};

export type TestResult = {
  id: string;
  testId: string;
  status: string;
  comment: string | null;
  elapsedSeconds: number | null;
  createdBy: string;
  createdAt: string;
};
export type IssueLink = { id: string; entityType: string; entityId: string; url: string; title: string | null; externalId: string | null; createdBy: string; createdAt: string };

export type RequirementLink = { id: string; projectId: string; caseId: string; requirementRef: string; title: string | null; createdAt: string };

export type RequirementsCoverageItem = { requirementRef: string; title: string | null; caseCount: number; caseIds: string[] };

export type Webhook = { id: string; projectId: string; url: string; events: string[]; isActive: boolean; createdAt: string };

export type AuditLogEntry = {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  projectId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type CaseVersion = {
  id: string;
  testCaseId: string;
  title: string;
  prerequisite: string | null;
  caseTypeId: string | null;
  priorityId: string | null;
  stepsSnapshot: { content: string; expected: string | null; sortOrder: number; sharedStepId?: string }[] | null;
  createdBy: string;
  createdAt: string;
};

export type Dataset = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  columns?: { id: string; datasetId: string; name: string; sortOrder: number }[];
  rows?: { id: string; datasetId: string; data: Record<string, string> }[];
};

export type RunTest = {
  id: string;
  runId: string;
  testCaseId: string;
  caseTitle: string;
  sectionId?: string | null;
  sectionName?: string | null;
  datasetRowId?: string;
  datasetRow?: Record<string, string>;
  latestResult: { id: string; status: string; comment: string | null; elapsedSeconds: number | null; createdAt: string } | null;
};
