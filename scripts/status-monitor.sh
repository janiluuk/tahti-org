#!/usr/bin/env bash
# M11: probe Tahti status surfaces (Upptime substitute until ops/upptime/ is deployed).
#
# Usage:
#   ./scripts/status-monitor.sh
#   API_URL=https://api.staging.tahti.live APP_URL=https://app.staging.tahti.live ./scripts/status-monitor.sh

set -euo pipefail

API_URL="${API_URL:-https://api.tahti.live}"
APP_URL="${APP_URL:-https://app.tahti.live}"

check() {
  local label="$1"
  local url="$2"
  echo "→ $label: $url"
  curl -fsS --max-time 15 --retry 2 --retry-delay 3 "$url" >/dev/null
  echo "  OK"
}

check_json_status() {
  local url="$1"
  echo "→ API status JSON: $url"
  local body
  body=$(curl -fsS --max-time 15 --retry 2 --retry-delay 3 "$url")
  if ! printf '%s' "$body" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
    echo "  FAIL: response missing status ok"
    printf '%s\n' "$body" | head -c 500
    exit 1
  fi
  echo "  OK"
}

check_json_status "${API_URL%/}/api/v1/status"
check "API health" "${API_URL%/}/health"
check "Web home" "${APP_URL%/}/"
check "Transparency" "${APP_URL%/}/transparency"
check "Status page" "${APP_URL%/}/status"

echo "All status checks passed."
