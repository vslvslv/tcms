import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CaseSearchBar } from "./CaseSearchBar";

// Mock the api module
vi.mock("../api", () => ({
  api: vi.fn(),
}));

import { api } from "../api";
const mockApi = vi.mocked(api);

function renderBar(projectId = "proj-1") {
  return render(
    <MemoryRouter>
      <CaseSearchBar projectId={projectId} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CaseSearchBar", () => {
  it("renders search input", () => {
    renderBar();
    expect(screen.getByPlaceholderText("Search test cases by title…")).toBeTruthy();
  });

  it("does not show results panel when query is empty", () => {
    renderBar();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows empty state when API returns no results", async () => {
    mockApi.mockResolvedValue([]);
    renderBar();
    const input = screen.getByPlaceholderText("Search test cases by title…");
    fireEvent.change(input, { target: { value: "xyz" } });
    // Wait for debounce + API
    await waitFor(
      () => expect(screen.getByText(/No cases match/)).toBeTruthy(),
      { timeout: 1000 }
    );
  });

  it("renders result items from API response", async () => {
    mockApi.mockResolvedValue([
      { id: "c1", title: "Login test", sectionId: "s1", sectionPath: ["Auth", "Login"] },
      { id: "c2", title: "Logout test", sectionId: "s1", sectionPath: ["Auth"] },
    ]);
    renderBar();
    fireEvent.change(screen.getByPlaceholderText("Search test cases by title…"), { target: { value: "log" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy(), { timeout: 1000 });
    expect(screen.getByText("Login test")).toBeTruthy();
    expect(screen.getByText("Logout test")).toBeTruthy();
  });

  it("shows section breadcrumb below result title", async () => {
    mockApi.mockResolvedValue([
      { id: "c1", title: "Login test", sectionId: "s1", sectionPath: ["Auth", "Login"] },
    ]);
    renderBar();
    fireEvent.change(screen.getByPlaceholderText("Search test cases by title…"), { target: { value: "log" } });
    await waitFor(() => expect(screen.getByText("Auth › Login")).toBeTruthy(), { timeout: 1000 });
  });

  it("clears results when Escape is pressed", async () => {
    mockApi.mockResolvedValue([
      { id: "c1", title: "Login test", sectionId: "s1", sectionPath: [] },
    ]);
    renderBar();
    const input = screen.getByPlaceholderText("Search test cases by title…");
    fireEvent.change(input, { target: { value: "login" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy(), { timeout: 1000 });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("moves active index on ArrowDown", async () => {
    mockApi.mockResolvedValue([
      { id: "c1", title: "First", sectionId: "s1", sectionPath: [] },
      { id: "c2", title: "Second", sectionId: "s1", sectionPath: [] },
    ]);
    renderBar();
    const input = screen.getByPlaceholderText("Search test cases by title…");
    fireEvent.change(input, { target: { value: "test" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy(), { timeout: 1000 });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    // First item should be active (aria-selected)
    const options = screen.getAllByRole("option");
    expect(options[0].getAttribute("aria-selected")).toBe("true");
  });

  it("has correct ARIA roles for accessibility", () => {
    renderBar();
    expect(screen.getByRole("search")).toBeTruthy();
  });
});
