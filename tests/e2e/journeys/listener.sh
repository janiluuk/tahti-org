#!/usr/bin/env bash
# Listener journey — public discovery without login (docs/technical/journey-listener.md).

run_listener_journey() {
  echo ""
  echo "── Listener journey ──────────────────────────────────────"

  local profile tiers smart ch access

  profile=$(curl -sf "$API_URL/api/v1/u/${E2E_DEMO_ARTIST_USER}/profile" 2>/dev/null || echo '{}')
  if echo "$profile" | grep -q '"releases"'; then
    e2e_green "public profile lists releases"
    e2e_check_json "profile links channel" '"/c/' "$profile"
  else
    e2e_yellow "public profile skipped (no demo artist)"
  fi

  tiers=$(curl -sf "$API_URL/api/v1/u/${E2E_DEMO_ARTIST_USER}/tiers" 2>/dev/null || echo '{}')
  e2e_check_json "public fan tiers" '"tiers"' "$tiers"

  smart=$(curl -sf "$API_URL/api/v1/r/${E2E_DEMO_SMART_SLUG}" 2>/dev/null || echo '{}')
  e2e_check_json "smart link release title" 'Northern Lights' "$smart"

  ch=$(curl -sf "$API_URL/api/channels/${E2E_DEMO_ARTIST_USER}" 2>/dev/null || echo '{}')
  e2e_check_json "channel metadata" '"slug"' "$ch"

  access=$(curl -sf "$API_URL/api/chat/${E2E_DEMO_ARTIST_USER}/access" 2>/dev/null || echo '{}')
  e2e_check_json "chat access exposes fanChatEnabled" 'fanChatEnabled' "$access"

  local trans_code
  trans_code=$(e2e_http_code "$API_URL/api/v1/transparency/ytd")
  e2e_check_http "transparency ytd public" '200' "$trans_code"

  if e2e_app_reachable "/transparency"; then
    e2e_green "web: transparency page"
  else
    e2e_yellow "web: transparency skipped (APP not up)"
  fi

  if e2e_app_reachable "/u/${E2E_DEMO_ARTIST_USER}"; then
    e2e_green "web: artist profile"
  else
    e2e_yellow "web: profile page skipped"
  fi

  if e2e_app_reachable "/c/${E2E_DEMO_ARTIST_USER}"; then
    e2e_green "web: channel page"
  else
    e2e_yellow "web: channel page skipped"
  fi

  if e2e_app_reachable "/r/${E2E_DEMO_SMART_SLUG}"; then
    e2e_green "web: smart link landing"
  else
    e2e_yellow "web: smart link skipped"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  JOURNEYS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../helpers.sh
  source "$JOURNEYS_DIR/../helpers.sh"
  # shellcheck source=fixtures.sh
  source "$JOURNEYS_DIR/fixtures.sh"
  e2e_wait_for_api "$API_URL/health" || exit 1
  run_listener_journey
  e2e_summary "Listener journey" || exit 1
fi
