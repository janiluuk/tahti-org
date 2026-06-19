#!/usr/bin/env bash
# Local-only: Docker stack + seed fixtures + Playwright screenshots.
# Not used in CI (see tests/e2e/vital-flows.sh and .github/workflows/ci.yml).
#
# Usage:
#   ./scripts/e2e-screenshots.sh           # stack up, seed, capture
#   ./scripts/e2e-screenshots.sh --capture # stack must already be up + seeded

set -euo pipefail

if [[ -n "${CI:-}" || -n "${GITHUB_ACTIONS:-}" ]]; then
  echo "e2e-screenshots.sh is for local docs only — not CI." >&2
  echo "CI runs: pnpm ci:check, pnpm test, tests/e2e/vital-flows.sh" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CAPTURE_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --capture) CAPTURE_ONLY=true ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ "$CAPTURE_ONLY" == true ]]; then
  exec "$ROOT/scripts/stack-screenshots.sh"
fi

echo "── E2E screenshots (local) ─────────────────────────────────"
export WEB_PORT="${WEB_PORT:-17777}"
export API_PORT="${API_PORT:-15011}"
"$ROOT/scripts/stack-up.sh" --seed
docker compose -f "$ROOT/infra/docker-compose.stack.yml" exec -T redis redis-cli FLUSHDB >/dev/null 2>&1 || true
"$ROOT/scripts/stack-screenshots.sh"
echo ""
echo "── Fresh artist journey screenshots ──"
APP_URL="http://localhost:${WEB_PORT}" API_URL="http://localhost:${API_PORT}" \
  node "$ROOT/tests/e2e/fresh-artist-journey.mjs"
