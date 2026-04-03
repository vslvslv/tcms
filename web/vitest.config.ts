import { defineConfig } from "vitest/config";

// Separate from vite.config.ts — the @tailwindcss/vite plugin is incompatible
// with the JSDOM environment required for React component tests.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    setupFiles: ["src/test-setup.ts"],
  },
});
