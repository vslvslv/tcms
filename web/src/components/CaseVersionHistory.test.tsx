import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CaseVersionHistory } from "./CaseVersionHistory";

vi.mock("../api", () => ({
  api: vi.fn(),
}));

import { api } from "../api";
const mockApi = vi.mocked(api);

const VERSIONS = [
  {
    id: "v2",
    testCaseId: "case-1",
    title: "Login with valid credentials",
    prerequisite: null,
    caseTypeId: null,
    priorityId: null,
    stepsSnapshot: [],
    createdBy: "user-1",
    createdAt: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: "v1",
    testCaseId: "case-1",
    title: "Login test",
    prerequisite: null,
    caseTypeId: null,
    priorityId: null,
    stepsSnapshot: [],
    createdBy: "user-1",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

const USERS = [{ id: "user-1", email: "admin@tcms.local", name: "Admin" }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("CaseVersionHistory", () => {
  it("renders nothing when no versions exist", async () => {
    mockApi.mockResolvedValueOnce([]).mockResolvedValueOnce(USERS);
    const { container } = render(<CaseVersionHistory caseId="case-1" />);
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2));
    expect(container.firstChild).toBeNull();
  });

  it("shows error state when load fails", async () => {
    mockApi.mockRejectedValue(new Error("Network error"));
    render(<CaseVersionHistory caseId="case-1" />);
    await waitFor(() =>
      expect(screen.getByText("Failed to load version history.")).toBeTruthy()
    );
  });

  it("renders version list with correct version numbers", async () => {
    mockApi.mockResolvedValueOnce(VERSIONS).mockResolvedValueOnce(USERS);
    render(<CaseVersionHistory caseId="case-1" />);
    await waitFor(() => expect(screen.getByText("v2")).toBeTruthy());
    expect(screen.getByText("v1")).toBeTruthy();
  });

  it("shows Restore button only for non-latest versions (idx > 0)", async () => {
    mockApi.mockResolvedValueOnce(VERSIONS).mockResolvedValueOnce(USERS);
    render(<CaseVersionHistory caseId="case-1" />);
    await waitFor(() => expect(screen.getByText("v1")).toBeTruthy());
    // v1 is idx 1 (older), should have Restore; v2 is idx 0 (latest), should not
    const restoreButtons = screen.queryAllByText("Restore");
    expect(restoreButtons).toHaveLength(1);
  });

  it("calls restore API and shows error on failure", async () => {
    mockApi
      .mockResolvedValueOnce(VERSIONS)
      .mockResolvedValueOnce(USERS)
      .mockRejectedValueOnce(new Error("Restore failed"));
    render(<CaseVersionHistory caseId="case-1" />);
    await waitFor(() => expect(screen.getByText("Restore")).toBeTruthy());
    fireEvent.click(screen.getByText("Restore"));
    await waitFor(() =>
      expect(screen.getByText("Restore failed")).toBeTruthy()
    );
  });

  it("calls onRestored after successful restore", async () => {
    const onRestored = vi.fn();
    mockApi
      .mockResolvedValueOnce(VERSIONS)
      .mockResolvedValueOnce(USERS)
      .mockResolvedValueOnce(undefined) // restore POST
      .mockResolvedValueOnce(VERSIONS); // reload versions
    render(<CaseVersionHistory caseId="case-1" onRestored={onRestored} />);
    await waitFor(() => expect(screen.getByText("Restore")).toBeTruthy());
    fireEvent.click(screen.getByText("Restore"));
    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
  });

  it("disables Compare button when same version selected for both", async () => {
    mockApi.mockResolvedValueOnce(VERSIONS).mockResolvedValueOnce(USERS);
    render(<CaseVersionHistory caseId="case-1" />);
    await waitFor(() => expect(screen.getByText("Compare versions")).toBeTruthy());
    const compareBtn = screen.getByText("Compare versions");
    expect(compareBtn).toBeDisabled();
  });
});
