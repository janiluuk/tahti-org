#!/usr/bin/env bash
# Vital functionality e2e — money, governance, fan-subs, transparency.
# Runs against a live API (local dev, staging, or CI with API started).
#
# Usage:
#   API_URL=http://localhost:3001 ./tests/e2e/vital-flows.sh
#
# Prerequisites:
#   - API running with Postgres schema pushed
#   - HCAPTCHA_SECRET=dev (or unset) for registration
#   - Stripe not required (membership + fan-subs use dev-direct activation)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=helpers.sh
source "$SCRIPT_DIR/helpers.sh"

UNIQUE=$(date +%s)
ARTIST_USER="e2e-artist-${UNIQUE}"
FAN_USER="e2e-fan-${UNIQUE}"
ARTIST_EMAIL="e2e-artist-${UNIQUE}@test.tahti.live"
FAN_EMAIL="e2e-fan-${UNIQUE}@test.tahti.live"
PASS='testpassword123'

echo "── Tahti vital flows e2e ─────────────────────────────────"
echo "   API: $API_URL"
echo ""

if ! e2e_wait_for_api "$API_URL/health"; then
  e2e_red "API not reachable at $API_URL"
  exit 1
fi
e2e_green "API health reachable"

HEALTH=$(curl -sf "$API_URL/health" || echo '{}')
e2e_check_json "health status ok" '"status":"ok"' "$HEALTH"

STATUS=$(curl -sf "$API_URL/api/v1/status" 2>/dev/null || echo '{}')
e2e_check_json "status has database check" '"database"' "$STATUS"

# ── Artist: register → verify (DB token via API is not available; set verify in dev path) ──
# Registration only — full verify needs MailHog or test DB access.
REG=$(curl -sf -X POST "$API_URL/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ARTIST_EMAIL\",\"password\":\"$PASS\",\"username\":\"$ARTIST_USER\",\"displayName\":\"E2E Artist\"}" \
  2>/dev/null || echo '{}')
e2e_check_json "artist register returns userId" '"userId"' "$REG"

# For e2e without MailHog we use a second pre-verified fixture via login after manual verify is skipped:
# Create flow using login only if we can verify via prisma in CI — not available in bash.
# Instead: test endpoints that do not require full onboarding.

# ── Transparency (no auth) ───────────────────────────────────────────────────
echo ""
echo "── Transparency (public) ─────────────────────────────────"

CATS=$(curl -sf "$API_URL/api/v1/transparency/categories" 2>/dev/null || echo '{}')
e2e_check_json "transparency categories" 'REVENUE_SUBSCRIPTION' "$CATS"

YTD=$(curl -sf "$API_URL/api/v1/transparency/ytd" 2>/dev/null || echo '{}')
e2e_check_json "transparency ytd runningSurplus" 'runningSurplus' "$YTD"

GRANTS=$(curl -sf "$API_URL/api/v1/transparency/grants/2031" 2>/dev/null || echo '{}')
e2e_check_json "transparency grants report" '"year":2031' "$GRANTS"

# ── Fan tiers public 404 for unknown artist ──────────────────────────────────
echo ""
echo "── Fan subscriptions ─────────────────────────────────────"

TIERS_404=$(e2e_http_code "$API_URL/api/v1/u/no-such-artist-${UNIQUE}/tiers" || echo '000')
e2e_check_http "unknown artist tiers 404" '404' "$TIERS_404"

PROFILE_404=$(e2e_http_code "$API_URL/api/v1/u/no-such-artist-${UNIQUE}/profile" || echo '000')
e2e_check_http "unknown artist profile 404" '404' "$PROFILE_404"

SMART_404=$(e2e_http_code "$API_URL/api/v1/r/no-such-release-${UNIQUE}" || echo '000')
e2e_check_http "unknown smart link 404" '404' "$SMART_404"

# ── Auth guards ──────────────────────────────────────────────────────────────
echo ""
echo "── Auth guards ───────────────────────────────────────────"

ME=$(e2e_http_code "$API_URL/api/auth/me" || echo '000')
e2e_check_http "GET /api/auth/me without session 401" '401' "$ME"

GOV=$(e2e_http_code "$API_URL/api/v1/governance/members" || echo '000')
e2e_check_http "governance members without session 401" '401' "$GOV"

MSHIP=$(e2e_http_code -X POST "$API_URL/api/me/membership/checkout" || echo '000')
e2e_check_http "membership checkout without session 401" '401' "$MSHIP"

# ── Stripe webhook accepts synthetic event (no signature in dev) ───────────────
echo ""
echo "── Stripe webhook ────────────────────────────────────────"

WH=$(curl -sS -X POST "$API_URL/api/webhooks/stripe" \
  -H 'Content-Type: application/json' \
  -d '{"type":"checkout.session.completed","data":{"object":{"id":"e2e_cs_'"$UNIQUE"'","amount_total":4000,"metadata":{"type":"membership","userId":"nonexistent"}}}}}' \
  2>/dev/null || echo '{}')
e2e_check_json "webhook returns received" '"received":true' "$WH"

# ── Internal broadcast cap (no auth — internal route) ────────────────────────
echo ""
echo "── Broadcast cap (internal) ──────────────────────────────"

ICE=$(e2e_http_code -X POST "$API_URL/internal/icecast/on_connect" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'mount=/live/no-such&pass=x' || echo '000')
e2e_check_http "icecast unknown mount 403" '403' "$ICE"

e2e_summary "Vital flows e2e" || exit 1
