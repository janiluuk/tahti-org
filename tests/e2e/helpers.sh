#!/usr/bin/env bash
# Shared helpers for Tahti API e2e scripts.
# Source from other scripts: source "$(dirname "$0")/helpers.sh"

set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
APP_URL="${APP_URL:-http://localhost:3000}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/tahti_e2e_cookies.txt}"

E2E_PASS=0
E2E_FAIL=0
E2E_WARN=0

e2e_green()   { printf "\033[32m✓\033[0m %s\n" "$1"; E2E_PASS=$((E2E_PASS + 1)); }
e2e_red()     { printf "\033[31m✗\033[0m %s\n" "$1"; E2E_FAIL=$((E2E_FAIL + 1)); }
e2e_yellow()  { printf "\033[33m⚠\033[0m %s\n" "$1"; E2E_WARN=$((E2E_WARN + 1)); }

e2e_wait_for_api() {
  local url="${1:-$API_URL/health}"
  local tries="${2:-30}"
  for ((i = 1; i <= tries; i++)); do
    if curl -sf "$url" &>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# HTTP status only — do not use curl -f; failed requests still print %{http_code}
# and -f would make `cmd || echo 000` append 000 → 404000.
e2e_http_code() {
  curl -sS -o /dev/null -w '%{http_code}' "$@"
}

e2e_check_http() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    e2e_green "$label"
  else
    e2e_red "$label — expected HTTP $expected, got $actual"
  fi
}

e2e_check_json() {
  local label="$1"
  local pattern="$2"
  local json="$3"
  if echo "$json" | grep -q "$pattern"; then
    e2e_green "$label"
  else
    e2e_red "$label — pattern '$pattern' not in: $json"
  fi
}

e2e_summary() {
  local name="$1"
  echo ""
  echo "── $name ─────────────────────────────────────────"
  echo "   Passed: $E2E_PASS / Failed: $E2E_FAIL / Warnings: $E2E_WARN"
  if [[ $E2E_FAIL -gt 0 ]]; then
    echo "   RESULT: FAILED"
    return 1
  fi
  echo "   RESULT: PASSED ✓"
  return 0
}

e2e_app_reachable() {
  local path="${1:-/}"
  e2e_http_code "$APP_URL$path" | grep -q '^200$'
}

e2e_api_login() {
  local email="$1"
  local pass="$2"
  rm -f "$COOKIE_JAR"
  local code
  code=$(e2e_http_code -c "$COOKIE_JAR" -X POST "$API_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}")
  [[ "$code" == "200" ]]
}

e2e_seed_journey_fixtures() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    e2e_yellow "DATABASE_URL unset — skip journey fixture seed"
    return 1
  fi
  (cd "$(dirname "$0")/../../apps/api" && pnpm exec tsx scripts/seed-e2e-screenshots.ts) >/dev/null
}
