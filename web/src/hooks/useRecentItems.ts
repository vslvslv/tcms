import { useState, useCallback, useEffect } from "react";

export type RecentItem = {
  url: string;
  title: string;
  type: "case" | "run" | "page";
  projectName?: string;
};

const STORAGE_KEY = "tcms-recent-items";
const MAX_ITEMS = 10;

/** Entity URL prefixes that are worth tracking. */
const TRACKED_PREFIXES = ["/cases/", "/runs/", "/milestones/", "/projects/"];

function isTrackedUrl(url: string): boolean {
  return TRACKED_PREFIXES.some((p) => url.startsWith(p));
}

function load(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentItem[];
  } catch {
    return [];
  }
}

function save(items: RecentItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

/**
 * Push an item into recent history.
 *
 * - Deduplicates by URL (most recent wins, moved to front).
 * - React 18 Strict Mode guard: if the exact same URL is already first, skip.
 * - Only entity URLs are tracked (not /dashboard, /settings, etc.).
 * - Persists to localStorage; max 10 items.
 *
 * URL contract (ISSUE 60): full pathname, e.g. /projects/{id}/cases/{id}
 * Use window.location.pathname or React Router `location.pathname`.
 */
export function pushRecentItem(item: RecentItem) {
  if (!isTrackedUrl(item.url)) return;
  const current = load();
  // React 18 Strict Mode dedup: already at front, skip
  if (current[0]?.url === item.url) return;
  const next = [item, ...current.filter((i) => i.url !== item.url)].slice(0, MAX_ITEMS);
  save(next);
  // Notify other hook instances in the same tab
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

/** Hook: returns the current recent items list. Re-renders on pushRecentItem() calls. */
export function useRecentItems(): RecentItem[] {
  const [items, setItems] = useState<RecentItem[]>(load);

  const refresh = useCallback(() => {
    setItems(load());
  }, []);

  useEffect(() => {
    // Cross-tab sync + intra-tab notifications
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [refresh]);

  return items;
}
