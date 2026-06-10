#!/usr/bin/env bash
# Unified smoke runner — phases from docs/unified-test-plan.md
#
# Usage:
#   ./scripts/unified-smoke.sh              # Phase 0–1 (local)
#   ./scripts/unified-smoke.sh --prod       # + Phase 6 production HTTP checks
#   ./scripts/unified-smoke.sh --e2e        # + vital-flows + user journeys (stack up)
#   ./scripts/unified-smoke.sh --seed       # seed e2e demo fixtures before --e2e
#   ./scripts/unified-smoke.sh --all        # prod + e2e
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROD=false
E2E=false
SEED=false
for arg in "$@"; do
  case "$arg" in
    --prod) PROD=true ;;
    --e2e) E2E=true ;;
    --seed) SEED=true ;;
    --all) PROD=true; E2E=true ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

FAIL=0
pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

echo "══ Phase 0 — CI gate ══"
if pnpm ci:check >/dev/null 2>&1; then
  pass "pnpm ci:check"
else
  fail "pnpm ci:check"
fi

echo ""
echo "══ Phase 1 — Stack health (local) ══"
API_URL="${API_URL:-http://localhost:15011}"
WEB_URL="${WEB_URL:-http://localhost:17777}"

if curl -sf "${API_URL}/health" >/dev/null 2>&1; then
  pass "API ${API_URL}/health"
  HEALTH=$(curl -sf "${API_URL}/health" || echo '{}')
  if echo "$HEALTH" | grep -q '"postgres":"up"'; then
    pass "Postgres up in /health"
  else
    fail "Postgres not up in /health"
  fi
  if curl -sf -X POST "${API_URL}/api/chat/tahti-radio/viewer-token" | grep -q '"token"'; then
    pass "Radio chat token (tahti-radio seeded)"
  else
    fail "Radio chat token — run seed-tahti-radio.ts"
  fi
else
  echo "  ⚠ API not reachable at ${API_URL} — skip local stack checks (start with ./scripts/stack-up.sh)"
fi

if curl -sf "${WEB_URL}/" >/dev/null 2>&1; then
  pass "Web ${WEB_URL}/"
  if curl -sf "${WEB_URL}/radio" | grep -qE 'ch-youtube-player|ch-player-wrap'; then
    pass "Local /radio player markup"
  else
    fail "Local /radio missing player (rebuild web?)"
  fi
else
  echo "  ⚠ Web not reachable at ${WEB_URL}"
fi

if [[ "$PROD" == true ]]; then
  echo ""
  echo "══ Phase 6 — Production smoke ══"
  PAPI="${PROD_API_URL:-https://api.tahti.live}"
  PWEB="${PROD_WEB_URL:-https://app.tahti.live}"

  prod_check() {
    local label="$1"
    local cmd="$2"
    if eval "$cmd" >/dev/null 2>&1; then pass "$label"; else fail "$label"; fi
  }

  prod_check "Prod API health" "curl -sf ${PAPI}/health | grep -q postgres"
  prod_check "Prod API status" "curl -sf ${PAPI}/api/v1/status | grep -q postgres"
  prod_check "Prod app home" "curl -sf ${PWEB}/ | grep -qi tahti"
  prod_check "Prod /listen" "curl -sf ${PWEB}/listen | grep -qi listen"
  prod_check "Prod /radio player" "curl -sf ${PWEB}/radio | grep -q ch-youtube-player"
  prod_check "Prod radio chat" "curl -sf -X POST ${PAPI}/api/chat/tahti-radio/viewer-token | grep -q token"
  prod_check "Prod transparency" "curl -sf ${PAPI}/api/v1/transparency/ytd | grep -q runningSurplus"
  prod_check "Prod /login" "test \$(curl -sf -o /dev/null -w '%{http_code}' ${PWEB}/login) = 200"
  prod_check "Prod /status" "curl -sf ${PWEB}/status | grep -qi status"
fi

if [[ "$E2E" == true ]]; then
  echo ""
  echo "══ Phase 2–5 — E2E journeys ══"
  if ! curl -sf "${API_URL}/health" >/dev/null 2>&1; then
    fail "E2E skipped — API not up at ${API_URL}"
  else
    export API_URL
    export APP_URL="${APP_URL:-http://localhost:17777}"
    if [[ "$SEED" == true ]]; then
      echo "  Seeding journey fixtures..."
      if DATABASE_URL="${DATABASE_URL:-postgresql://tahti:tahti_dev@localhost:16432/tahti}" \
        pnpm dlx tsx apps/api/scripts/seed-e2e-screenshots.ts >/dev/null 2>&1; then
        pass "e2e fixtures seeded"
      else
        fail "e2e fixture seed failed"
      fi
    fi
    if bash tests/e2e/vital-flows.sh; then
      pass "vital-flows.sh"
    else
      fail "vital-flows.sh"
    fi
    if bash tests/e2e/user-journeys.sh; then
      pass "user-journeys.sh"
    else
      fail "user-journeys.sh"
    fi
  fi
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "✓ unified-smoke passed"
  exit 0
fi
echo "✗ unified-smoke: ${FAIL} check(s) failed"
exit 1
