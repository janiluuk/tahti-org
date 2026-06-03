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
"$ROOT/scripts/stack-up.sh" --seed
"$ROOT/scripts/stack-screenshots.sh"
