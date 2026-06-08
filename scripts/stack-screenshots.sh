#!/usr/bin/env bash
# Capture full-page screenshots (Playwright) against a running Docker stack.
# Does not start the stack or seed — use ./scripts/e2e-screenshots.sh for the full flow.
#
# Usage:
#   ./scripts/stack-up.sh --seed
#   ./scripts/stack-screenshots.sh
#   # or: ./scripts/e2e-screenshots.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/docs/e2e-screenshots"
export WEB_PORT="${WEB_PORT:-17777}"
export API_PORT="${API_PORT:-15011}"
APP_URL="${APP_URL:-http://localhost:${WEB_PORT}}"
API_URL="${API_URL:-http://localhost:${API_PORT}}"

if [[ -n "${CI:-}" || -n "${GITHUB_ACTIONS:-}" ]]; then
  echo "stack-screenshots.sh is not run in CI." >&2
  exit 1
fi

if ! curl -sf "$API_URL/health" &>/dev/null; then
  echo "API not reachable at $API_URL" >&2
  echo "Run: ./scripts/e2e-screenshots.sh  or  ./scripts/stack-up.sh --seed" >&2
  exit 1
fi

if [[ ! -f "$OUT/.seed-output.json" ]]; then
  echo "Missing $OUT/.seed-output.json — seed fixtures first:" >&2
  echo "  ./scripts/stack-up.sh --seed" >&2
  echo "  ./scripts/e2e-screenshots.sh" >&2
  exit 1
fi

VERIFY_TOKEN="$(node -e "const j=JSON.parse(require('fs').readFileSync('$OUT/.seed-output.json','utf8')); console.log(j.verifyToken||'')")"
export APP_URL API_URL SCREENSHOT_VERIFY_TOKEN="$VERIFY_TOKEN"

echo "── Capturing screenshots via Docker stack ──"
echo "   App: $APP_URL"
echo "   API: $API_URL"
node "$ROOT/scripts/capture-e2e-screenshots.mjs"

echo "── Done: $OUT"
