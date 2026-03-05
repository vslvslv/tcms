const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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
export type TestCase = { id: string; sectionId: string; title: string; prerequisite: string | null; sortOrder: number; steps?: TestStep[] };
export type Run = {
  id: string;
  suiteId: string;
  name: string;
  description: string | null;
  createdBy: string;
  isCompleted: boolean;
  tests?: RunTest[];
  summary?: { passed: number; failed: number; blocked: number; skipped: number; untested: number };
};
export type RunTest = {
  id: string;
  runId: string;
  testCaseId: string;
  caseTitle: string;
  latestResult: { id: string; status: string; comment: string | null; elapsedSeconds: number | null; createdAt: string } | null;
};
