#!/usr/bin/env bash
# User journey e2e — viewer, artist, and streamer paths from docs/guides/.
#
# Usage:
#   API_URL=http://localhost:3001 APP_URL=http://localhost:3010 bash tests/e2e/user-journeys.sh
#
# With seeded demo fixtures (recommended):
#   DATABASE_URL=postgres://tahti:tahti_dev@localhost:5432/tahti \
#     API_URL=http://localhost:3001 APP_URL=http://localhost:3010 \
#     bash tests/e2e/user-journeys.sh
#
# Prerequisites:
#   - API running, schema pushed
#   - Optional: run seed via e2e_seed_journey_fixtures (or stack --seed)
#   - Optional: APP_URL for web page checks

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=helpers.sh
source "$SCRIPT_DIR/helpers.sh"

DEMO_ARTIST_EMAIL="${E2E_DEMO_ARTIST_EMAIL:-screenshot-artist@e2e.tahti.live}"
DEMO_ARTIST_USER="${E2E_DEMO_ARTIST_USER:-screenshot-demo}"
DEMO_FAN_EMAIL="${E2E_DEMO_FAN_EMAIL:-screenshot-fan@e2e.tahti.live}"
DEMO_PASS="${E2E_DEMO_PASS:-screenshot-demo-pass}"
DEMO_SMART_SLUG="${E2E_DEMO_SMART_SLUG:-northern-lights-ep}"
DEMO_ICECAST_PASS="${E2E_DEMO_ICECAST_PASS:-screenshot-pass}"

echo "── Tahti user journey e2e ────────────────────────────────"
echo "   API: $API_URL"
echo "   APP: $APP_URL"
echo ""

if ! e2e_wait_for_api "$API_URL/health"; then
  e2e_red "API not reachable"
  exit 1
fi
e2e_green "API health OK"

if [[ -n "${SEED_JOURNEY_FIXTURES:-}" ]] && e2e_seed_journey_fixtures; then
  e2e_green "Journey fixtures seeded"
elif curl -sf "$API_URL/api/v1/u/${DEMO_ARTIST_USER}/profile" 2>/dev/null | grep -q '"username"'; then
  e2e_green "Demo artist profile present (pre-seeded)"
else
  e2e_yellow "Demo fixtures missing — set SEED_JOURNEY_FIXTURES=1 or run stack --seed"
fi

# ── Viewer journey (listener / fan browsing) ─────────────────────────────────
echo ""
echo "── Viewer journey ────────────────────────────────────────"

PROFILE=$(curl -sf "$API_URL/api/v1/u/${DEMO_ARTIST_USER}/profile" 2>/dev/null || echo '{}')
if echo "$PROFILE" | grep -q '"releases"'; then
  e2e_green "public profile lists releases"
  e2e_check_json "profile links channel" '"/c/' "$PROFILE"
else
  e2e_yellow "public profile skipped (no demo artist)"
fi

TIERS=$(curl -sf "$API_URL/api/v1/u/${DEMO_ARTIST_USER}/tiers" 2>/dev/null || echo '{}')
e2e_check_json "public fan tiers" '"tiers"' "$TIERS"

SMART=$(curl -sf "$API_URL/api/v1/r/${DEMO_SMART_SLUG}" 2>/dev/null || echo '{}')
e2e_check_json "smart link release title" 'Northern Lights' "$SMART"

CH=$(curl -sf "$API_URL/api/channels/${DEMO_ARTIST_USER}" 2>/dev/null || echo '{}')
e2e_check_json "channel metadata" '"slug"' "$CH"

ACCESS=$(curl -sf "$API_URL/api/chat/${DEMO_ARTIST_USER}/access" 2>/dev/null || echo '{}')
e2e_check_json "chat access exposes fanChatEnabled" 'fanChatEnabled' "$ACCESS"

if e2e_app_reachable "/transparency"; then
  e2e_green "web: transparency page"
else
  e2e_yellow "web: transparency skipped (APP not up)"
fi

if e2e_app_reachable "/u/${DEMO_ARTIST_USER}"; then
  e2e_green "web: artist profile"
else
  e2e_yellow "web: profile page skipped"
fi

if e2e_app_reachable "/c/${DEMO_ARTIST_USER}"; then
  e2e_green "web: channel page"
else
  e2e_yellow "web: channel page skipped"
fi

if e2e_app_reachable "/r/${DEMO_SMART_SLUG}"; then
  e2e_green "web: smart link landing"
else
  e2e_yellow "web: smart link skipped"
fi

if e2e_app_reachable "/help/multistream"; then
  e2e_green "web: multistream help"
else
  e2e_yellow "web: multistream help skipped"
fi

# ── Artist journey (member studio) ───────────────────────────────────────────
echo ""
echo "── Artist journey ────────────────────────────────────────"

if e2e_api_login "$DEMO_ARTIST_EMAIL" "$DEMO_PASS"; then
  e2e_green "artist login"

  ME=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/auth/me" 2>/dev/null || echo '{}')
  e2e_check_json "session has channel" '"channel"' "$ME"
  e2e_check_json "artist is member" '"isMember":true' "$ME"

  MS=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/membership" 2>/dev/null || echo '{}')
  e2e_check_json "membership status" '"status"' "$MS"

  REL=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/releases" 2>/dev/null || echo '[]')
  if echo "$REL" | grep -q 'Northern Lights'; then
    e2e_green "dashboard releases include demo EP"
  else
    e2e_yellow "dashboard releases empty or different seed"
  fi

  FT=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/fan-tiers" 2>/dev/null || echo '[]')
  e2e_check_json "fan tiers configured" 'Supporter' "$FT"

  if e2e_app_reachable "/dashboard"; then
    e2e_green "web: artist dashboard"
  else
    e2e_yellow "web: dashboard skipped"
  fi
else
  e2e_yellow "artist login skipped — seed demo user first"
fi

# ── Streamer journey (live ingest) ───────────────────────────────────────────
echo ""
echo "── Streamer journey ────────────────────────────────────────"

if [[ -f "$COOKIE_JAR" ]] && e2e_api_login "$DEMO_ARTIST_EMAIL" "$DEMO_PASS"; then
  SS=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/stream-settings" 2>/dev/null || echo '{}')
  e2e_check_json "stream settings RTMP server" 'rtmp' "$SS"
  e2e_check_json "stream settings Icecast server" 'icecast' "$SS"
  e2e_check_json "stream settings mount" '"/live/' "$SS"

  RTMP_LIST=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/rtmp-targets" 2>/dev/null || echo '[]')
  if echo "$RTMP_LIST" | grep -q '^\['; then
    e2e_green "multistream targets list OK"
  fi

  MOUNT="/live/${DEMO_ARTIST_USER}"
  ICE_CODE=$(e2e_http_code -X POST "$API_URL/internal/icecast/on_connect" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d "mount=${MOUNT}&pass=${DEMO_ICECAST_PASS}")
  if [[ "$ICE_CODE" == "200" ]]; then
    e2e_green "Icecast on_connect accepts demo source"
    curl -sf -X POST "$API_URL/internal/icecast/on_disconnect" \
      -H 'Content-Type: application/x-www-form-urlencoded' \
      -d "mount=${MOUNT}" >/dev/null || true
  else
    e2e_yellow "Icecast on_connect returned $ICE_CODE (cap or fixture)"
  fi
else
  e2e_yellow "streamer journey skipped — no artist session"
fi

# ── Fan supporter journey ────────────────────────────────────────────────────
echo ""
echo "── Fan supporter journey ─────────────────────────────────"

if e2e_api_login "$DEMO_FAN_EMAIL" "$DEMO_PASS"; then
  e2e_green "fan login"
  SUBS=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/subscriptions" 2>/dev/null || echo '[]')
  if echo "$SUBS" | grep -q 'screenshot-demo'; then
    e2e_green "fan sees subscription to demo artist"
  else
    e2e_yellow "fan subscriptions empty (optional seed)"
  fi

  if e2e_app_reachable "/u/${DEMO_ARTIST_USER}/subscribe"; then
    e2e_green "web: subscribe page"
  fi
else
  e2e_yellow "fan login skipped"
fi

e2e_summary "User journey e2e" || exit 1
