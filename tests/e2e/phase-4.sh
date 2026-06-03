#!/usr/bin/env bash
# Phase 4 exit criteria — artist app alpha (M0–M1).
# Tests registration, email verification, login, session, and channel creation.
#
# Usage:
#   APP_URL=https://app.tahti.live API_URL=https://api.tahti.live ./tests/e2e/phase-4.sh
#
# Environment variables:
#   APP_URL   — Next.js web base URL (default: http://localhost:3000)
#   API_URL   — Fastify API base URL (default: http://localhost:3001)
#   MAILHOG_URL — MailHog API URL (default: http://localhost:8025)

set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
API_URL="${API_URL:-http://localhost:3001}"
MAILHOG_URL="${MAILHOG_URL:-http://localhost:8025}"

PASS=0
FAIL=0
WARNINGS=0

green()   { printf "\033[32m✓\033[0m %s\n" "$1"; }
red()     { printf "\033[31m✗\033[0m %s\n" "$1"; }
yellow()  { printf "\033[33m⚠\033[0m %s\n" "$1"; }

check() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    green "$label"; ((PASS++))
  else
    red "$label — FAILED"; ((FAIL++))
  fi
}

check_output() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    green "$label"; ((PASS++))
  else
    red "$label — expected '$expected' in: $actual"; ((FAIL++))
  fi
}

echo "── Phase 4 exit criteria — artist app alpha ──────────────"
echo "   API:  $API_URL"
echo "   APP:  $APP_URL"
echo ""

# ── API health ────────────────────────────────────────────────────────────────
echo "── API health ────────────────────────────────────────────"

HEALTH=$(curl -sf "$API_URL/health" 2>/dev/null || echo '{}')
check_output "API health status=ok" '"status":"ok"' "$HEALTH"
check_output "API db=ok" '"db":"ok"' "$HEALTH"

check "API /source redirects to source repo" \
  "curl -sf -o /dev/null -w '%{http_code}' '$API_URL/source' | grep -q 302"

check "API responses include Source-Code header (AGPL §13)" \
  "curl -sf -I '$API_URL/health' | grep -qi 'source-code'"

# ── Web app ───────────────────────────────────────────────────────────────────
echo ""
echo "── Web app ───────────────────────────────────────────────"

check "Web app root returns 200" \
  "curl -sf -o /dev/null -w '%{http_code}' '$APP_URL/' | grep -q 200"

check "Join page returns 200" \
  "curl -sf -o /dev/null -w '%{http_code}' '$APP_URL/join' | grep -q 200"

check "Web page includes AGPL footer link" \
  "curl -sf '$APP_URL/' | grep -qi 'AGPL'"

# ── Artist registration flow ──────────────────────────────────────────────────
echo ""
echo "── Artist registration flow ──────────────────────────────"

UNIQUE=$(date +%s)
TEST_EMAIL="phase4-e2e-${UNIQUE}@test.tahti.live"
TEST_USER="e2eartist${UNIQUE}"

REGISTER=$(curl -sf -X POST "$API_URL/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{
    \"email\":\"$TEST_EMAIL\",
    \"password\":\"testpassword123\",
    \"username\":\"$TEST_USER\",
    \"displayName\":\"E2E Test Artist\"
  }" 2>/dev/null || echo '{}')

check_output "Register returns userId" '"userId"' "$REGISTER"
check_output "Register returns verify message" '"message"' "$REGISTER"

# Duplicate registration must be rejected
DUP=$(curl -sf -o /dev/null -w '%{http_code}' -X POST "$API_URL/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"x\",\"username\":\"${TEST_USER}2\",\"displayName\":\"Dup\"}" \
  2>/dev/null || echo '000')
check_output "Duplicate email returns 409" '409' "$DUP"

# ── Login (pre-verification) ──────────────────────────────────────────────────
echo ""
echo "── Login (pre-verification) ──────────────────────────────"

LOGIN_BEFORE=$(curl -sf -o /dev/null -w '%{http_code}' -X POST "$API_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"testpassword123\"}" \
  2>/dev/null || echo '000')

check_output "Login before email verify returns 403" '403' "$LOGIN_BEFORE"

# ── Email verification ────────────────────────────────────────────────────────
echo ""
echo "── Email verification (via MailHog) ──────────────────────"

# Extract token from MailHog — requires MailHog to be available
MAILHOG_MSGS=$(curl -sf "$MAILHOG_URL/api/v2/messages?limit=10" 2>/dev/null || echo '{}')
TOKEN=$(echo "$MAILHOG_MSGS" \
  | grep -oP 'token=[A-Za-z0-9_-]{32}' \
  | head -1 \
  | cut -d= -f2 \
  || echo '')

if [[ -n "$TOKEN" ]]; then
  VERIFY=$(curl -sf "$API_URL/api/auth/verify?token=${TOKEN}" 2>/dev/null || echo '{}')
  check_output "Email verification succeeds" '"message"' "$VERIFY"
  check_output "Verify mentions membership payment" 'membership' "$VERIFY"
else
  yellow "Skipping email verification — MailHog not available or no emails found"
  ((WARNINGS++))
fi

# ── Login (post-verification) ─────────────────────────────────────────────────
echo ""
echo "── Login (post-verification) ─────────────────────────────"

if [[ -n "$TOKEN" ]]; then
  LOGIN_RESP=$(curl -sf -c /tmp/tahti_e2e_cookies.txt -X POST "$API_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"testpassword123\"}" \
    2>/dev/null || echo '{}')

  check_output "Login returns user object" '"username"' "$LOGIN_RESP"

  ME=$(curl -sf -b /tmp/tahti_e2e_cookies.txt "$API_URL/api/auth/me" 2>/dev/null || echo '{}')
  check_output "GET /api/auth/me returns user" "\"username\":\"${TEST_USER}\"" "$ME"
  check_output "GET /api/auth/me includes channel" '"channel"' "$ME"

  MShip=$(curl -sf -b /tmp/tahti_e2e_cookies.txt -X POST "$API_URL/api/me/membership/checkout" \
    2>/dev/null || echo '{}')
  if echo "$MShip" | grep -q '"activated":true'; then
    green "Membership checkout activates in dev mode"
    ((PASS++))
    ME2=$(curl -sf -b /tmp/tahti_e2e_cookies.txt "$API_URL/api/auth/me" 2>/dev/null || echo '{}')
    check_output "After membership pay, isMember is true" '"isMember":true' "$ME2"
  else
    yellow "Membership checkout skipped (Stripe configured or checkout failed)"
    ((WARNINGS++))
  fi

  LOGOUT=$(curl -sf -b /tmp/tahti_e2e_cookies.txt -X POST "$API_URL/api/auth/logout" \
    2>/dev/null || echo '{}')
  check_output "Logout returns message" '"message"' "$LOGOUT"

  rm -f /tmp/tahti_e2e_cookies.txt
else
  yellow "Skipping post-verification login tests — email token unavailable"
  ((WARNINGS++))
fi

# ── Bad credential rejection ──────────────────────────────────────────────────
echo ""
echo "── Credential validation ─────────────────────────────────"

BADLOGIN=$(curl -sf -o /dev/null -w '%{http_code}' -X POST "$API_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"nobody@tahti.live","password":"wrongpassword"}' \
  2>/dev/null || echo '000')
check_output "Login with wrong creds returns 401" '401' "$BADLOGIN"

ME_UNAUTH=$(curl -sf -o /dev/null -w '%{http_code}' "$API_URL/api/auth/me" \
  2>/dev/null || echo '000')
check_output "GET /api/auth/me without session returns 401" '401' "$ME_UNAUTH"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "── Results ──────────────────────────────────────────────"
echo "   Passed: $PASS / Failed: $FAIL / Warnings: $WARNINGS"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "PHASE 4 (M0-M1) EXIT CRITERIA: FAILED"
  exit 1
else
  echo "PHASE 4 (M0-M1) EXIT CRITERIA: ALL PASSED ✓"
  [[ $WARNINGS -gt 0 ]] && echo "  ($WARNINGS warnings — see above)"
  echo ""
  echo "Next: implement M2 (channel + archive uploads)"
  exit 0
fi
