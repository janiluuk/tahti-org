#!/usr/bin/env bash
# Artist journey — member with channel, studio APIs (docs/technical/journey-artist.md).

run_artist_journey() {
  echo ""
  echo "── Artist journey ──────────────────────────────────────────"

  if ! e2e_api_login "$E2E_DEMO_ARTIST_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "artist login skipped — seed demo user first"
    return 0
  fi
  e2e_green "artist login"

  local me ms rel ft
  me=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/auth/me" 2>/dev/null || echo '{}')
  e2e_check_json "session has channel" '"channel"' "$me"
  e2e_check_json "artist is cooperative member" '"isMember":true' "$me"

  ms=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/membership" 2>/dev/null || echo '{}')
  e2e_check_json "membership status" '"status"' "$ms"

  rel=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/releases" 2>/dev/null || echo '[]')
  if echo "$rel" | grep -q 'Northern Lights'; then
    e2e_green "dashboard releases include demo EP"
  else
    e2e_yellow "dashboard releases empty or different seed"
  fi

  ft=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/fan-tiers" 2>/dev/null || echo '[]')
  e2e_check_json "fan tiers configured" 'Supporter' "$ft"

  if e2e_app_reachable "/dashboard"; then
    e2e_green "web: artist dashboard"
  else
    e2e_yellow "web: dashboard skipped"
  fi
}

run_streamer_journey() {
  echo ""
  echo "── Streamer journey (artist ingest) ──────────────────────"

  if ! e2e_api_login "$E2E_DEMO_ARTIST_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "streamer journey skipped — no artist session"
    return 0
  fi

  local ss rtmp_list mount ice_code
  ss=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/stream-settings" 2>/dev/null || echo '{}')
  e2e_check_json "stream settings RTMP server" 'rtmp' "$ss"
  e2e_check_json "stream settings Icecast server" 'icecast' "$ss"
  e2e_check_json "stream settings mount" '"/live/' "$ss"

  rtmp_list=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/rtmp-targets" 2>/dev/null || echo '[]')
  if echo "$rtmp_list" | grep -q '^\['; then
    e2e_green "multistream targets list OK"
  fi

  mount="/live/${E2E_DEMO_ARTIST_USER}"
  ice_code=$(e2e_http_code -X POST "$API_URL/internal/icecast/on_connect" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d "mount=${mount}&pass=${E2E_DEMO_ICECAST_PASS}")
  if [[ "$ice_code" == "200" ]]; then
    e2e_green "Icecast on_connect accepts demo source"
    curl -sf -X POST "$API_URL/internal/icecast/on_disconnect" \
      -H 'Content-Type: application/x-www-form-urlencoded' \
      -d "mount=${mount}" >/dev/null || true
  else
    e2e_yellow "Icecast on_connect returned $ice_code (cap or fixture)"
  fi

  if e2e_app_reachable "/help/multistream"; then
    e2e_green "web: multistream help"
  else
    e2e_yellow "web: multistream help skipped"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  JOURNEYS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../helpers.sh
  source "$JOURNEYS_DIR/../helpers.sh"
  # shellcheck source=fixtures.sh
  source "$JOURNEYS_DIR/fixtures.sh"
  e2e_wait_for_api "$API_URL/health" || exit 1
  run_artist_journey
  run_streamer_journey
  e2e_summary "Artist journey" || exit 1
fi
