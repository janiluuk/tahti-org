#!/usr/bin/env bash
# Weekly / manual smoke: build the full Docker stack and probe key surfaces.
# Used by .github/workflows/stack-smoke.yml (not on every PR — stack build is ~15–30 min).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${API_PORT:-15011}"
WEB_PORT="${WEB_PORT:-17777}"

cleanup() {
  "${ROOT}/scripts/stack-up.sh" --down 2>/dev/null || true
}
trap cleanup EXIT

echo "── Stack smoke: bringing up compose stack ──"
"${ROOT}/scripts/stack-up.sh"

echo "── Stack smoke: API probes ──"
curl -sf "http://localhost:${API_PORT}/health" | grep -q '"status":"ok"'
curl -sf "http://localhost:${API_PORT}/api/v1/status" | grep -q '"status"'

echo "── Stack smoke: web probes ──"
curl -sf "http://localhost:${WEB_PORT}/" | grep -qi tahti
curl -sf "http://localhost:${WEB_PORT}/transparency" | grep -qi transparency

echo "── Stack smoke: PgBouncer port ──"
if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -h 127.0.0.1 -p "${PGBOUNCER_PORT:-16432}" -U tahti
else
  curl -sf "http://localhost:${API_PORT}/health" >/dev/null
  echo "(pg_isready not installed — API health via pooler is sufficient)"
fi

echo "✓ Stack smoke passed"
