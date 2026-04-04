#!/usr/bin/env node
/**
 * validate-oklch.mjs
 * Reads web/src/index.css and validates all oklch() token values.
 * Fails with exit code 1 if any value has channels outside valid ranges:
 *   L: [0, 1]   — lightness
 *   C: >= 0     — chroma (unbounded, but negative is invalid)
 *   H: [0, 360] — hue
 *
 * Browsers silently treat invalid oklch() as transparent — no visual warning.
 * This script catches typos at CI time.
 *
 * Usage:
 *   node scripts/validate-oklch.mjs [path/to/file.css]
 *   npm run validate:tokens  (default: web/src/index.css)
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = process.argv[2] ?? resolve(__dirname, "../web/src/index.css");

let css;
try {
  css = readFileSync(cssPath, "utf8");
} catch (e) {
  console.error(`validate-oklch: cannot read file: ${cssPath}`);
  process.exit(1);
}

// Match oklch(...) — handles spaces, none keyword, and optional alpha
// oklch( L C H )  or  oklch( L C H / alpha )
const OKLCH_RE = /oklch\(\s*([^\s)\/]+)\s+([^\s)\/]+)\s+([^\s)\/\s]+)(?:\s*\/\s*[^\s)]+)?\s*\)/g;

let errors = 0;
let total = 0;
let lineNum = 0;

for (const line of css.split("\n")) {
  lineNum++;
  let match;
  OKLCH_RE.lastIndex = 0;
  while ((match = OKLCH_RE.exec(line)) !== null) {
    total++;
    const [full, lRaw, cRaw, hRaw] = match;

    // Skip CSS custom property references like oklch(var(--foo) ...) or "none"
    if (lRaw.startsWith("var(") || cRaw.startsWith("var(") || hRaw.startsWith("var(")) {
      continue;
    }
    if (lRaw === "none" || cRaw === "none" || hRaw === "none") {
      continue;
    }

    const L = parseFloat(lRaw);
    const C = parseFloat(cRaw);
    const H = parseFloat(hRaw);

    const issues = [];
    if (isNaN(L)) issues.push(`L="${lRaw}" is not a number`);
    else if (L < 0 || L > 1) issues.push(`L=${L} out of range [0, 1]`);

    if (isNaN(C)) issues.push(`C="${cRaw}" is not a number`);
    else if (C < 0) issues.push(`C=${C} is negative (invalid)`);

    if (isNaN(H)) issues.push(`H="${hRaw}" is not a number`);
    else if (H < 0 || H > 360) issues.push(`H=${H} out of range [0, 360]`);

    if (issues.length > 0) {
      console.error(`${cssPath}:${lineNum}: invalid oklch value: ${full.trim()}`);
      for (const issue of issues) {
        console.error(`  → ${issue}`);
      }
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\nvalidate-oklch: ${errors} invalid value(s) found in ${total} total oklch() tokens.`);
  console.error("Fix these before committing — browsers silently render invalid oklch() as transparent.\n");
  process.exit(1);
}

console.log(`validate-oklch: ${total} oklch() tokens checked — all valid. ✓`);
