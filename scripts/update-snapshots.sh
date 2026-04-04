#!/usr/bin/env bash
# update-snapshots.sh
# Runs Playwright snapshot updates inside the official mcr.microsoft.com/playwright
# container for reproducible baselines across contributor machines.
#
# Usage (from repo root):
#   bash scripts/update-snapshots.sh
#
# This ensures snapshots are generated in the same Linux/Chromium environment
# used by CI, regardless of your local OS (macOS, Windows, Linux).
#
# Prerequisites: Docker must be running.
# The script mounts the entire repo into the container and runs the visual tests
# with --update-snapshots, writing new baseline PNGs to web/tests/visual/snapshots/.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAYWRIGHT_VERSION="1.42.0"
IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy"

echo "update-snapshots: pulling ${IMAGE}..."
docker pull "${IMAGE}"

echo "update-snapshots: running snapshot update in container..."
docker run --rm \
  -v "${REPO_ROOT}:/work" \
  -w /work/web \
  --ipc=host \
  "${IMAGE}" \
  bash -c "
    npm ci --prefer-offline 2>/dev/null || npm ci
    npx playwright test --config=playwright.visual.config.ts --update-snapshots
  "

echo ""
echo "update-snapshots: done. New baselines written to web/tests/visual/snapshots/"
echo "Review the changes with 'git diff web/tests/visual/snapshots/' then commit."
