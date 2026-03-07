#!/usr/bin/env node
/**
 * Opens a browser, navigates to URL, and monitors for failures.
 * Usage: node monitor.js [URL]
 * Env: PLAYWRIGHT_MONITOR_DURATION_MS (optional) - exit after N ms; omit to run until Ctrl+C.
 */

const url = process.argv[2] || 'http://localhost:5173';
const durationMs = process.env.PLAYWRIGHT_MONITOR_DURATION_MS
  ? parseInt(process.env.PLAYWRIGHT_MONITOR_DURATION_MS, 10)
  : null;

const failures = [];
let browser;

async function main() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (e) {
    console.error('Playwright not found. Install with: npm install -D playwright && npx playwright install chromium');
    process.exit(2);
  }

  browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error') {
      const text = msg.text();
      failures.push({ type: 'console', message: text });
      console.error('[CONSOLE ERROR]', text);
    }
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const what = request.url();
    const reason = failure ? failure.errorText : 'unknown';
    failures.push({ type: 'request', url: what, reason });
    console.error('[REQUEST FAILED]', what, reason);
  });

  page.on('pageerror', (err) => {
    failures.push({ type: 'pageerror', message: err.message });
    console.error('[PAGE ERROR]', err.message);
  });

  const responseHandler = (response) => {
    const status = response.status();
    if (status >= 400) {
      const reqUrl = response.url();
      failures.push({ type: 'response', url: reqUrl, status });
      console.error('[BAD RESPONSE]', status, reqUrl);
    }
  };
  page.on('response', responseHandler);

  console.log('Monitoring', url, durationMs ? `(will exit after ${durationMs}ms)` : '(Ctrl+C to stop)');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => {
    failures.push({ type: 'navigation', message: e.message });
    console.error('[NAVIGATION ERROR]', e.message);
  });

  function exit() {
    process.exit(failures.length > 0 ? 1 : 0);
  }

  if (durationMs) {
    await new Promise((r) => setTimeout(r, durationMs));
    await browser.close();
    exit();
  } else {
    process.on('SIGINT', async () => {
      if (browser) await browser.close();
      exit();
    });
    await new Promise(() => {}); // run until SIGINT
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
