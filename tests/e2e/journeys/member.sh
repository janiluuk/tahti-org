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

run_feature_request_journey() {
  echo ""
  echo "── Feature request journey ─────────────────────────────────"

  if ! e2e_api_login "$E2E_DEMO_MEMBER_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "feature request journey skipped — no member session"
    return 0
  fi

  local create_res feature_id list vote_res comment_res

  create_res=$(curl -sf -b "$COOKIE_JAR" -X POST "$API_URL/api/v1/governance/feature-requests" \
    -H 'Content-Type: application/json' \
    -d '{"title":"E2E: add keyboard shortcuts","description":"Would help power users navigate faster."}' \
    2>/dev/null || echo '{}')
  e2e_check_json "feature request created" '"status":"OPEN"' "$create_res"
  feature_id=$(echo "$create_res" | grep -oP '"id":"\K[^"]+' || echo '')

  if [[ -z "$feature_id" ]]; then
    e2e_yellow "feature request journey skipped — could not parse create response"
    return 0
  fi

  list=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/v1/governance/feature-requests" 2>/dev/null || echo '[]')
  e2e_check_json "feature request appears in the board" "$feature_id" "$list"

  vote_res=$(curl -sf -b "$COOKIE_JAR" -X POST \
    "$API_URL/api/v1/governance/feature-requests/${feature_id}/vote" 2>/dev/null || echo '{}')
  e2e_check_json "member can vote for a feature request" '"voteCount":1' "$vote_res"

  comment_res=$(curl -sf -b "$COOKIE_JAR" -X POST \
    "$API_URL/api/v1/governance/feature-requests/${feature_id}/comments" \
    -H 'Content-Type: application/json' \
    -d '{"body":"E2E discussion comment"}' 2>/dev/null || echo '{}')
  e2e_check_json "member can comment on a feature request" 'E2E discussion comment' "$comment_res"

  if e2e_api_login "$E2E_DEMO_BOARD_EMAIL" "$E2E_DEMO_PASS"; then
    local admin_list patch_res
    admin_list=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/admin/feature-requests" 2>/dev/null || echo '[]')
    e2e_check_json "board sees the request in the admin list" "$feature_id" "$admin_list"

    patch_res=$(curl -sf -b "$COOKIE_JAR" -X PATCH "$API_URL/api/admin/feature-requests/${feature_id}" \
      -H 'Content-Type: application/json' \
      -d '{"status":"PLANNED","reviewNote":"E2E: adding to roadmap"}' 2>/dev/null || echo '{}')
    e2e_check_json "board can mark a request planned" '"status":"PLANNED"' "$patch_res"
  else
    e2e_yellow "board review step skipped — no board session"
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
  run_feature_request_journey
  run_fan_supporter_journey
  e2e_summary "Member journey" || exit 1
fi
