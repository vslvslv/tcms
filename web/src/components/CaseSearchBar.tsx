import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CaseSearchResult } from "../api";
import { Input } from "./ui/Input";

interface CaseSearchBarProps {
  projectId: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function CaseSearchBar({ projectId }: CaseSearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CaseSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 250);
  // Derived: loading while query has changed but debounce hasn't caught up yet
  const loading = query.trim() !== debouncedQuery.trim() && query.trim().length > 0;

  useEffect(() => {
    if (!debouncedQuery.trim()) return;
    let cancelled = false;
    api<CaseSearchResult[]>(`/api/projects/${projectId}/cases/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((data) => { if (!cancelled) { setResults(data); setActiveIndex(-1); } })
      .catch(() => { if (!cancelled) setResults([]); });
    return () => { cancelled = true; };
  }, [debouncedQuery, projectId]);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      navigate(`/cases/${results[activeIndex].id}`);
      clear();
    } else if (e.key === "Escape") {
      clear();
    }
  }

  const hasResults = results.length > 0;
  const showPanel = query.trim().length > 0;

  return (
    <form role="search" aria-label="Search test cases" className="relative mb-4" onSubmit={(e) => e.preventDefault()}>
      <div className="relative flex items-center">
        <svg
          className="pointer-events-none absolute left-3 h-4 w-4 text-muted"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <Input
          ref={inputRef}
          type="search"
          placeholder="Search test cases by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Search test cases"
          aria-autocomplete="list"
          aria-controls="case-search-results"
          aria-activedescendant={activeIndex >= 0 ? `case-result-${activeIndex}` : undefined}
          className="w-full pl-9 pr-8"
        />
        {loading && (
          <span className="absolute right-3 flex items-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" aria-label="Searching" />
          </span>
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-3 text-muted hover:text-text"
          >
            ✕
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-md">
          {loading && !hasResults && (
            <div className="p-4 text-center text-sm text-muted">Searching…</div>
          )}
          {!loading && !hasResults && (
            <div className="p-4 text-center text-sm text-muted">
              No cases match &quot;{query}&quot;.{" "}
              <button type="button" onClick={clear} className="text-primary hover:underline">Clear search</button>
            </div>
          )}
          {hasResults && (
            <ul
              id="case-search-results"
              ref={listRef}
              role="listbox"
              aria-label="Search results"
              className="max-h-96 overflow-y-auto py-1"
            >
              {results.map((r, i) => (
                <li
                  key={r.id}
                  id={`case-result-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`cursor-pointer px-4 py-2 hover:bg-surface-raised ${i === activeIndex ? "bg-primary/5" : ""}`}
                  onMouseDown={() => { navigate(`/cases/${r.id}`); clear(); }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <div className="text-sm font-medium text-text">{r.title}</div>
                  {r.sectionPath.length > 0 && (
                    <div className="mt-0.5 text-xs text-muted">{r.sectionPath.join(" › ")}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
