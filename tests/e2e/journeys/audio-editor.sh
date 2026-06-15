#!/usr/bin/env bash
# Multitrack audio editor e2e — opens editor from seeded archive item + screenshot.

run_audio_editor_journey() {
  echo ""
  echo "── Audio editor journey (Playwright) ─────────────────────"

  if ! e2e_api_login "$E2E_DEMO_ARTIST_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "audio editor skipped — seed demo artist first"
    return 0
  fi
  e2e_green "artist login for editor"

  local arch
  arch=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/archive" 2>/dev/null || echo '[]')
  if echo "$arch" | grep -q 'Live at Klubi'; then
    e2e_green "archive API lists demo mix for editor"
  else
    e2e_yellow "archive missing demo mix — editor test may fail"
  fi

  if ! command -v node >/dev/null 2>&1; then
    e2e_yellow "node not found — skip Playwright editor capture"
    return 0
  fi

  if APP_URL="${APP_URL:-http://localhost:17777}" API_URL="$API_URL" node "$ROOT/tests/e2e/audio-editor.mjs"; then
    e2e_green "audio editor Playwright + screenshot"
  else
    e2e_red "audio editor Playwright failed"
    return 1
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  JOURNEYS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ROOT="$(cd "$JOURNEYS_DIR/../.." && pwd)"
  # shellcheck source=../helpers.sh
  source "$JOURNEYS_DIR/../helpers.sh"
  # shellcheck source=fixtures.sh
  source "$JOURNEYS_DIR/fixtures.sh"
  e2e_wait_for_api "$API_URL/health" || exit 1
  run_audio_editor_journey
  e2e_summary "Audio editor journey" || exit 1
fi
