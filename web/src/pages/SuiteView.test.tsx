import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SuiteView from "../pages/SuiteView";

vi.mock("../api", () => ({
  api: vi.fn(),
}));

import { api } from "../api";
const mockApi = vi.mocked(api);

const SUITE = {
  id: "suite-1",
  projectId: "proj-1",
  name: "Auth Suite",
  description: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const SECTIONS = [
  {
    id: "sec-1",
    suiteId: "suite-1",
    parentId: null,
    name: "Login",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function renderSuite() {
  return render(
    <MemoryRouter initialEntries={["/suites/suite-1"]}>
      <Routes>
        <Route path="/suites/:suiteId" element={<SuiteView />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.mockResolvedValueOnce(SUITE).mockResolvedValueOnce(SECTIONS);
});

describe("SuiteView — CI failure panel", () => {
  it("CI failure panel is collapsed by default", async () => {
    renderSuite();
    await waitFor(() => expect(screen.getByText("Auth Suite")).toBeTruthy());
    expect(
      screen.getByText("Generate test cases from CI failure")
    ).toBeTruthy();
    expect(screen.queryByPlaceholderText(/FAIL src/)).toBeNull();
  });

  it("CI failure panel expands on toggle click", async () => {
    renderSuite();
    await waitFor(() => expect(screen.getByText("Auth Suite")).toBeTruthy());
    fireEvent.click(screen.getByText("Generate test cases from CI failure"));
    expect(screen.getByPlaceholderText(/FAIL src/)).toBeTruthy();
  });

  it("Generate button disabled when log is empty", async () => {
    renderSuite();
    await waitFor(() => expect(screen.getByText("Auth Suite")).toBeTruthy());
    fireEvent.click(screen.getByText("Generate test cases from CI failure"));
    const btn = screen.getByRole("button", { name: "Generate test cases" });
    expect(btn).toBeDisabled();
  });

  it("Generate button enabled after entering log text", async () => {
    renderSuite();
    await waitFor(() => expect(screen.getByText("Auth Suite")).toBeTruthy());
    fireEvent.click(screen.getByText("Generate test cases from CI failure"));
    const textarea = screen.getByPlaceholderText(/FAIL src/);
    fireEvent.change(textarea, { target: { value: "Error: test failed" } });
    const btn = screen.getByRole("button", { name: "Generate test cases" });
    expect(btn).not.toBeDisabled();
  });

  it("shows suggestions result after successful generation", async () => {
    const result = {
      suggestions: [
        {
          title: "Test invalid login",
          reasoning: "Catches the auth failure scenario",
          steps: [{ content: "Enter wrong password", expected: "401 returned" }],
        },
      ],
      created: 0,
      cases: [],
    };
    mockApi.mockResolvedValueOnce(result);
    renderSuite();
    await waitFor(() => expect(screen.getByText("Auth Suite")).toBeTruthy());
    fireEvent.click(screen.getByText("Generate test cases from CI failure"));
    const textarea = screen.getByPlaceholderText(/FAIL src/);
    fireEvent.change(textarea, { target: { value: "Error: login test failed" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate test cases" }));
    await waitFor(() =>
      expect(screen.getByText("Test invalid login")).toBeTruthy()
    );
    expect(screen.getByText("Catches the auth failure scenario")).toBeTruthy();
  });

  it("Try another failure resets result state", async () => {
    const result = {
      suggestions: [
        {
          title: "Test invalid login",
          reasoning: "Catches the auth failure scenario",
          steps: [],
        },
      ],
      created: 0,
      cases: [],
    };
    mockApi.mockResolvedValueOnce(result);
    renderSuite();
    await waitFor(() => expect(screen.getByText("Auth Suite")).toBeTruthy());
    fireEvent.click(screen.getByText("Generate test cases from CI failure"));
    const textarea = screen.getByPlaceholderText(/FAIL src/);
    fireEvent.change(textarea, { target: { value: "some error" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate test cases" }));
    await waitFor(() =>
      expect(screen.getByText("Try another failure")).toBeTruthy()
    );
    fireEvent.click(screen.getByText("Try another failure"));
    expect(screen.queryByText("Test invalid login")).toBeNull();
    expect(screen.getByPlaceholderText(/FAIL src/)).toBeTruthy();
  });
});
