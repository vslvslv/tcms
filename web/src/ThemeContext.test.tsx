/**
 * TC-1: ThemeContext graceful degradation when localStorage is unavailable
 *
 * Run with: npx vitest (requires vitest + @testing-library/react + jsdom)
 * Install: npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
 * Add to vite.config.ts: test: { environment: "jsdom", globals: true }
 *   → CORRECTION: create vitest.config.ts (separate file) — do NOT add test block
 *     to vite.config.ts; @tailwindcss/vite plugin is incompatible with JSDOM environment
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeContext";

function ThemeReadout() {
  const { theme } = useTheme();
  return <div data-testid="theme">{theme}</div>;
}

describe("ThemeContext", () => {
  describe("TC-1: localStorage unavailable (iOS Safari private mode)", () => {
    let originalGetItem: typeof localStorage.getItem;
    let originalSetItem: typeof localStorage.setItem;

    beforeEach(() => {
      originalGetItem = localStorage.getItem.bind(localStorage);
      originalSetItem = localStorage.setItem.bind(localStorage);
    });

    afterEach(() => {
      Object.defineProperty(window, "localStorage", {
        value: {
          ...localStorage,
          getItem: originalGetItem,
          setItem: originalSetItem,
        },
        writable: true,
      });
      document.documentElement.removeAttribute("data-theme");
    });

    it("mounts without error when localStorage.getItem throws SecurityError", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      });

      expect(() => {
        render(
          <ThemeProvider>
            <ThemeReadout />
          </ThemeProvider>
        );
      }).not.toThrow();
    });

    it("defaults to dark theme when localStorage is unavailable", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});

      const { getByTestId } = render(
        <ThemeProvider>
          <ThemeReadout />
        </ThemeProvider>
      );

      expect(getByTestId("theme").textContent).toBe("dark");
    });

    it("sets data-theme attribute on document even when localStorage throws", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      });

      render(
        <ThemeProvider>
          <ThemeReadout />
        </ThemeProvider>
      );

      expect(document.documentElement.dataset.theme).toBe("dark");
    });
  });

  describe("normal operation", () => {
    beforeEach(() => {
      localStorage.clear();
      document.documentElement.removeAttribute("data-theme");
    });

    it("reads light theme from localStorage on init", () => {
      localStorage.setItem("tcms-theme", "light");

      const { getByTestId } = render(
        <ThemeProvider>
          <ThemeReadout />
        </ThemeProvider>
      );

      expect(getByTestId("theme").textContent).toBe("light");
    });

    it("defaults to dark when no stored preference", () => {
      const { getByTestId } = render(
        <ThemeProvider>
          <ThemeReadout />
        </ThemeProvider>
      );

      expect(getByTestId("theme").textContent).toBe("dark");
    });
  });
});
