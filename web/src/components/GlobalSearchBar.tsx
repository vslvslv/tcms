import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, type SearchResult } from "../api";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function resultUrl(r: SearchResult): string {
  if (r.type === "case") return `/projects/${r.projectId}/cases/${r.id}`;
  return `/runs/${r.id}`;
}

export function GlobalSearchBar({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 3) { setResults([]); return; }
    api<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`)
      .then(setResults)
      .catch(() => setResults([]));
  }, [debouncedQuery]);

  // Reset active index when results change
  useEffect(() => { setActiveIndex(-1); }, [results]);

  const select = useCallback((r: SearchResult) => {
    navigate(resultUrl(r));
    onClose();
  }, [navigate, onClose]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      e.preventDefault();
      select(results[activeIndex]);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60"
      onClick={onClose}
      aria-label="Search overlay"
    >
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="search-modal"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            data-testid="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search test cases and runs…"
            className="min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">Esc</kbd>
        </div>

        {results.length > 0 && (
          <ul className="max-h-72 overflow-y-auto py-1">
            {results.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  data-testid={`search-result`}
                  onClick={() => select(r)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${i === activeIndex ? "bg-primary/10 text-primary" : "hover:bg-surface-raised"}`}
                >
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase ${r.type === "case" ? "bg-primary/10 text-primary" : "bg-surface-raised text-muted"}`}>
                    {r.type}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-text">{r.title}</span>
                  <span className="shrink-0 truncate text-xs text-muted">{r.projectName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.trim().length >= 3 && results.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted">No results for "{query.trim()}"</p>
        )}

        {query.trim().length < 3 && (
          <p className="px-4 py-3 text-xs text-muted">Type at least 3 characters to search</p>
        )}
      </div>
    </div>
  );
}
