#!/usr/bin/env bash
# Director / board journey — admin grants, exports, transparency (docs/technical/journey-director.md).

run_director_journey() {
  echo ""
  echo "── Director / board journey ──────────────────────────────"

  local preview_code export_code grants_pub
  preview_code=$(e2e_http_code "$API_URL/api/admin/grants/preview/${E2E_GRANT_YEAR}")
  e2e_check_http "grant preview without board session 401" '401' "$preview_code"

  export_code=$(e2e_http_code "$API_URL/api/admin/members/export.csv")
  e2e_check_http "members export without board session 401" '401' "$export_code"

  grants_pub=$(curl -sf "$API_URL/api/v1/transparency/grants/${E2E_GRANT_YEAR}" 2>/dev/null || echo '{}')
  e2e_check_json "public transparency grants report" '"year"' "$grants_pub"

  if ! e2e_api_login "$E2E_DEMO_BOARD_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "board login skipped — seed demo board user first"
    return 0
  fi
  e2e_green "board login"

  local me preview members_csv
  me=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/auth/me" 2>/dev/null || echo '{}')
  e2e_check_json "board session isBoard true" '"isBoard":true' "$me"

  preview=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/admin/grants/preview/${E2E_GRANT_YEAR}" 2>/dev/null || echo '{}')
  e2e_check_json "grant preview forYear" '"forYear"' "$preview"
  e2e_check_json "grant preview artist rows" '"artists"' "$preview"

  members_csv=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/admin/members/export.csv" 2>/dev/null || echo '')
  if echo "$members_csv" | grep -q 'memberNumber'; then
    e2e_green "members CSV export includes memberNumber header"
  else
    e2e_yellow "members CSV export empty or unexpected shape"
  fi

  if e2e_app_reachable "/transparency"; then
    e2e_green "web: transparency (director publishes here)"
  else
    e2e_yellow "web: transparency skipped"
  fi

  if e2e_app_reachable "/governance/venues"; then
    e2e_green "web: governance venues (board tooling)"
  else
    e2e_yellow "web: governance venues skipped"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  JOURNEYS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../helpers.sh
  source "$JOURNEYS_DIR/../helpers.sh"
  # shellcheck source=fixtures.sh
  source "$JOURNEYS_DIR/fixtures.sh"
  e2e_wait_for_api "$API_URL/health" || exit 1
  run_director_journey
  e2e_summary "Director journey" || exit 1
fi
