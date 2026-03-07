---
name: open-browser-monitor-failures
description: Opens a browser instance (using Playwright), navigates to a given URL such as the dev server, and monitors for failures (console errors, failed network requests, uncaught exceptions). Use when the user wants to open a browser and monitor for failures, run the app in a browser and watch for errors, or verify the app does not throw in the browser.
---

# Open Browser and Monitor for Failures

When the user wants to open a browser and monitor for failures:

1. **Ensure dev server is running** (e.g. `npm run dev` in `web/`). Note the URL (e.g. `http://localhost:5173` for Vite).
2. **Use Playwright** to launch a browser, open the URL, and attach failure listeners.
3. **Report** any console errors, failed requests, or page errors; exit non-zero if any occurred.

## Workflow

1. **Install Playwright** in the project (if not present):
   ```bash
   cd web && npm install -D @playwright/test playwright
   npx playwright install chromium
   ```

2. **Run the monitor script** from the `web/` directory (so Playwright resolves):
   ```bash
   cd web && node ../.cursor/skills/open-browser-monitor-failures/scripts/monitor.js [URL]
   ```
   Default URL: `http://localhost:5173`. Pass a different URL as the first argument if needed.

3. **Interpret output**:
   - Script runs until stopped (Ctrl+C) or for a configurable duration.
   - Any console error, failed request (4xx/5xx or network failure), or uncaught exception is printed and counted.
   - Exit code 0 = no failures; non-zero = at least one failure.

## What is monitored

| Source | What counts as failure |
|--------|-------------------------|
| Console | `console.error` or level `error` |
| Network | Request failure (e.g. 404, 500) or failed load (e.g. DNS, refused) |
| Page | Uncaught exception or unhandled rejection in the page |

## Optional: run from agent

When implementing or debugging the frontend, the agent may:

- Start the dev server in the background if not already running.
- Run the monitor script with the app URL.
- After a short period (or after a specific user action), stop and report whether any failures were seen.

## Script location

The executable script is at [scripts/monitor.js](scripts/monitor.js). It accepts one optional argument (URL) and uses `PLAYWRIGHT_MONITOR_DURATION_MS` (default: no limit; run until Ctrl+C) to optionally exit after N milliseconds.
