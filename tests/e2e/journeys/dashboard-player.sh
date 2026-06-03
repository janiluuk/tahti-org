#!/usr/bin/env bash
# Dashboard studio + channel/archive player API e2e (seeded demo artist).

run_dashboard_player_journey() {
  echo ""
  echo "── Dashboard & player journey (API) ──────────────────────"

  if ! e2e_api_login "$E2E_DEMO_ARTIST_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "dashboard/player skipped — seed demo artist first"
    return 0
  fi
  e2e_green "artist login for dashboard"

  local me rel arch stream gates items embed
  me=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/auth/me" 2>/dev/null || echo '{}')
  e2e_check_json "dashboard session has channel" '"channel"' "$me"

  rel=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/releases" 2>/dev/null || echo '[]')
  if echo "$rel" | grep -q 'Northern Lights'; then
    e2e_green "dashboard releases API lists demo EP"
  else
    e2e_yellow "dashboard releases missing demo EP"
  fi

  arch=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/archive" 2>/dev/null || echo '[]')
  if echo "$arch" | grep -q 'Live at Klubi'; then
    e2e_green "dashboard archive API lists demo mix"
  else
    e2e_yellow "dashboard archive missing demo mix"
  fi

  stream=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/stream-settings" 2>/dev/null || echo '{}')
  e2e_check_json "stream settings for ingest panel" 'rtmp' "$stream"

  gates=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/download-gate-stats" 2>/dev/null || echo '{}')
  e2e_check_json "download gate stats shape" '"items"' "$gates"

  items=$(curl -sf "$API_URL/api/channels/${E2E_DEMO_ARTIST_USER}/items" 2>/dev/null || echo '[]')
  if echo "$items" | grep -q 'Live at Klubi'; then
    e2e_green "public channel items include demo archive"
  else
    e2e_yellow "channel items missing demo archive"
  fi
  if echo "$items" | grep -q '"audioUrl"'; then
    e2e_green "channel items expose audioUrl for player"
  else
    e2e_yellow "channel items have no audioUrl (MinIO may be down)"
  fi

  embed=$(curl -sf "$API_URL/api/v1/embed/c/${E2E_DEMO_ARTIST_USER}" 2>/dev/null || echo '{}')
  e2e_check_json "embed channel metadata" '"profileUrl"' "$embed"
  if echo "$embed" | grep -q '"hlsUrl":null'; then
    e2e_green "embed offline has no HLS (expected for seeded channel)"
  fi

  if e2e_app_reachable "/dashboard"; then
    e2e_green "web: dashboard reachable"
  else
    e2e_yellow "web: dashboard skipped"
  fi

  if e2e_app_reachable "/c/${E2E_DEMO_ARTIST_USER}"; then
    e2e_green "web: channel page for player"
  else
    e2e_yellow "web: channel page skipped"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  JOURNEYS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../helpers.sh
  source "$JOURNEYS_DIR/../helpers.sh"
  # shellcheck source=fixtures.sh
  source "$JOURNEYS_DIR/fixtures.sh"
  e2e_wait_for_api "$API_URL/health" || exit 1
  run_dashboard_player_journey
  e2e_summary "Dashboard & player journey" || exit 1
fi
