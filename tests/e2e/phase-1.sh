#!/usr/bin/env bash
# Phase 1 exit criteria — tahti.live live over HTTPS
#
# Usage:
#   ./tests/e2e/phase-1.sh                        # tests production (tahti.live)
#   ./tests/e2e/phase-1.sh http://localhost:8080   # tests local dev server
#
# Exit codes: 0 = all pass, 1 = one or more failures

set -euo pipefail

BASE="${1:-https://tahti.live}"
PASS=0
FAIL=0

green() { printf "\033[32m✓\033[0m %s\n" "$1"; }
red()   { printf "\033[31m✗\033[0m %s\n" "$1"; }

check() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    green "$label"
    ((PASS++))
  else
    red "$label"
    ((FAIL++))
  fi
}

echo "── Phase 1 exit criteria ────────────────────────────────"
echo "   Target: $BASE"
echo ""

# 1. HTTP/HTTPS responds
check "GET / returns 200" \
  "curl -sf --max-time 5 -o /dev/null -w '%{http_code}' '$BASE' | grep -q '^200$'"

# 2. Health endpoint
check "GET /health returns 'ok'" \
  "curl -sf --max-time 5 '$BASE/health' | grep -q 'ok'"

# 3. TLS certificate (only meaningful for https:// target)
if [[ "$BASE" == https://* ]]; then
  HOST=$(echo "$BASE" | sed 's|https://||' | cut -d/ -f1)
  check "TLS certificate valid (issuer contains 'Let's Encrypt' or 'ACME')" \
    "curl -sv --max-time 5 '$BASE' 2>&1 | grep -qi 'issuer.*let.s encrypt\|issuer.*acme'"

  check "HTTPS redirects www to apex" \
    "curl -sf --max-time 5 -o /dev/null -w '%{http_code}' 'https://www.$HOST' | grep -qE '^(200|301|302)$'"
fi

# 4. Security headers
check "Response has X-Content-Type-Options header" \
  "curl -sf --max-time 5 -I '$BASE' | grep -qi 'x-content-type-options'"

check "Response has X-Frame-Options header" \
  "curl -sf --max-time 5 -I '$BASE' | grep -qi 'x-frame-options'"

check "Response has Strict-Transport-Security header (HTTPS only)" \
  "[[ '$BASE' != https://* ]] || curl -sf --max-time 5 -I '$BASE' | grep -qi 'strict-transport-security'"

# 5. Content
check "Response contains 'Tahti' in body" \
  "curl -sf --max-time 5 '$BASE' | grep -qi 'tahti'"

check "Response contains AGPL source link" \
  "curl -sf --max-time 5 '$BASE' | grep -qi 'agpl\|source\|github'"

# 6. Performance
RESPONSE_TIME=$(curl -sf --max-time 5 -o /dev/null -w '%{time_total}' "$BASE" 2>/dev/null || echo "99")
if (( $(echo "$RESPONSE_TIME < 0.5" | bc -l) )); then
  green "Response time < 500ms (actual: ${RESPONSE_TIME}s)"
  ((PASS++))
else
  red "Response time >= 500ms (actual: ${RESPONSE_TIME}s)"
  ((FAIL++))
fi

# 7. Docker image smoke test (local only)
if command -v docker &>/dev/null && [[ "$BASE" == http://localhost* ]]; then
  check "nginx worker process running in container" \
    "docker ps --filter 'name=tahti' --format '{{.Names}}' | grep -q website"
fi

echo ""
echo "── Results ──────────────────────────────────────────────"
echo "   Passed: $PASS"
echo "   Failed: $FAIL"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "PHASE 1 EXIT CRITERIA: FAILED"
  exit 1
else
  echo "PHASE 1 EXIT CRITERIA: ALL PASSED ✓"
  exit 0
fi
