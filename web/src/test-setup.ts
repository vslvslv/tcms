import "@testing-library/jest-dom";

// Provide a reliable localStorage in jsdom.
// vitest's jsdom has localStorage but clear() may not work due to the
// Storage prototype not being fully implemented in some jsdom versions.
const _store: Record<string, string> = {};
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: (k: string) => _store[k] ?? null,
    setItem: (k: string, v: string) => { _store[k] = String(v); },
    removeItem: (k: string) => { delete _store[k]; },
    clear: () => { Object.keys(_store).forEach((k) => delete _store[k]); },
    get length() { return Object.keys(_store).length; },
    key: (i: number) => Object.keys(_store)[i] ?? null,
  },
  writable: true,
  configurable: true,
});
