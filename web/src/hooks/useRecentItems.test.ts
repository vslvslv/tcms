import { describe, it, expect, beforeEach } from "vitest";
import { pushRecentItem } from "./useRecentItems";

const STORAGE_KEY = "tcms-recent-items";

const item = (url: string, title = "Test") => ({
  url,
  title,
  type: "case" as const,
  projectName: "Project",
});

describe("pushRecentItem", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores a tracked URL", () => {
    pushRecentItem(item("/cases/abc"));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].url).toBe("/cases/abc");
  });

  it("ignores non-tracked URLs like /dashboard", () => {
    pushRecentItem(item("/dashboard"));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignores /settings URLs", () => {
    pushRecentItem(item("/settings"));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("deduplicates by URL — moves to front", () => {
    pushRecentItem(item("/cases/a", "A"));
    pushRecentItem(item("/cases/b", "B"));
    pushRecentItem(item("/cases/a", "A updated"));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored[0].url).toBe("/cases/a");
    expect(stored).toHaveLength(2);
  });

  it("React 18 Strict Mode guard: skips if already first item", () => {
    pushRecentItem(item("/cases/a"));
    pushRecentItem(item("/cases/a")); // same URL, already front
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored).toHaveLength(1);
  });

  it("caps at 10 items", () => {
    for (let i = 0; i < 12; i++) {
      pushRecentItem(item(`/cases/${i}`, `Case ${i}`));
    }
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored).toHaveLength(10);
    // Most recent should be at front
    expect(stored[0].url).toBe("/cases/11");
  });

  it("handles localStorage parse errors gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    expect(() => pushRecentItem(item("/runs/x"))).not.toThrow();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored[0].url).toBe("/runs/x");
  });
});
