#!/usr/bin/env bash
# Cooperative member journey — governance, no channel required (docs/technical/journey-member.md).

run_member_journey() {
  echo ""
  echo "── Member journey (governance) ───────────────────────────"

  local anon_gov anon_motions
  anon_gov=$(e2e_http_code "$API_URL/api/v1/governance/members")
  e2e_check_http "governance members without session 401" '401' "$anon_gov"

  anon_motions=$(e2e_http_code "$API_URL/api/v1/governance/motions")
  e2e_check_http "governance motions without session 401" '401' "$anon_motions"

  if ! e2e_api_login "$E2E_DEMO_MEMBER_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "member login skipped — seed demo member first"
    return 0
  fi
  e2e_green "member login"

  local me members motions
  me=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/auth/me" 2>/dev/null || echo '{}')
  e2e_check_json "member isMember true" '"isMember":true' "$me"
  if echo "$me" | grep -q '"channel":null'; then
    e2e_green "member has no artist channel (listener-style account)"
  elif echo "$me" | grep -q '"channel":'; then
    e2e_yellow "member account has channel (still valid)"
  fi

  members=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/v1/governance/members" 2>/dev/null || echo '[]')
  e2e_check_json "governance directory lists demo artist" "$E2E_DEMO_ARTIST_USER" "$members"

  motions=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/v1/governance/motions" 2>/dev/null || echo '[]')
  if echo "$motions" | grep -q "$E2E_DEMO_MOTION_TITLE"; then
    e2e_green "governance lists seeded demo motion"
  else
    e2e_yellow "demo motion missing — re-run seed"
  fi

  if e2e_app_reachable "/governance"; then
    e2e_green "web: governance page"
  else
    e2e_yellow "web: governance skipped"
  fi
}

run_fan_supporter_journey() {
  echo ""
  echo "── Fan supporter journey ─────────────────────────────────"

  if ! e2e_api_login "$E2E_DEMO_MEMBER_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "fan login skipped"
    return 0
  fi
  e2e_green "fan supporter login"

  local subs
  subs=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/subscriptions" 2>/dev/null || echo '[]')
  if echo "$subs" | grep -q "$E2E_DEMO_ARTIST_USER"; then
    e2e_green "fan sees subscription to demo artist"
  else
    e2e_yellow "fan subscriptions empty (optional seed)"
  fi

  if e2e_app_reachable "/u/${E2E_DEMO_ARTIST_USER}/subscribe"; then
    e2e_green "web: subscribe page"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  JOURNEYS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../helpers.sh
  source "$JOURNEYS_DIR/../helpers.sh"
  # shellcheck source=fixtures.sh
  source "$JOURNEYS_DIR/fixtures.sh"
  e2e_wait_for_api "$API_URL/health" || exit 1
  run_member_journey
  run_fan_supporter_journey
  e2e_summary "Member journey" || exit 1
fi
