#!/usr/bin/env bash
# Release catalog journey — album (5 tracks) + EP + single, color schemes, draft/stash album.
# API-only checks when demo artist is seeded; full flow runs in Vitest (release-catalog.test.ts).
#
# Usage: bash tests/e2e/journeys/release-catalog.sh

run_release_catalog_journey() {
  echo ""
  echo "── Release catalog journey ─────────────────────────────────"

  if ! e2e_api_login "$E2E_DEMO_ARTIST_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "release catalog skipped — demo artist login failed"
    return 0
  fi

  local rel
  rel=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/releases" 2>/dev/null || echo '[]')

  if echo "$rel" | grep -q 'Deep Catalog Album'; then
    e2e_green "seeded catalog album present"
    e2e_check_json "album color scheme (teal accent)" '#00d4aa' "$rel"
  else
    e2e_yellow "seeded catalog album not found — run seed or Vitest release-catalog.test.ts"
  fi

  if echo "$rel" | grep -q 'Midnight Single'; then
    e2e_green "seeded catalog single present"
  fi

  if echo "$rel" | grep -q 'Northern Lights EP'; then
    e2e_green "seeded catalog EP present"
  fi

  local profile
  profile=$(curl -sf "$API_URL/api/v1/u/${E2E_DEMO_ARTIST_USER}/profile" 2>/dev/null || echo '{}')
  if echo "$profile" | grep -q 'Deep Catalog Album'; then
    e2e_red "draft album must not appear on public profile"
  else
    e2e_green "draft album hidden from public profile"
  fi

  local vault_code
  vault_code=$(e2e_http_code "$API_URL/api/v1/collections/${E2E_DEMO_ARTIST_USER}-album-stash" || echo '000')
  e2e_check_http "private album stash collection 404 publicly" '404' "$vault_code"

  if e2e_app_reachable "/dashboard#releases"; then
    e2e_green "web: dashboard releases tab"
  else
    e2e_yellow "web: dashboard releases skipped"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  JOURNEYS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../helpers.sh
  source "$JOURNEYS_DIR/../helpers.sh"
  # shellcheck source=fixtures.sh
  source "$JOURNEYS_DIR/fixtures.sh"
  e2e_wait_for_api "$API_URL/health" || exit 1
  e2e_seed_journey_fixtures || true
  run_release_catalog_journey
  e2e_summary "Release catalog journey" || exit 1
fi
