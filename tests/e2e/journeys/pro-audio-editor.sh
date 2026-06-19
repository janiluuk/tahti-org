#!/usr/bin/env bash
# Pro audio editor journey — EditList draft, render, multitrack projects (API checks on seeded demo).
#
# Usage: bash tests/e2e/journeys/pro-audio-editor.sh

run_pro_audio_editor_journey() {
  echo ""
  echo "── Pro audio editor journey ────────────────────────────────"

  if ! e2e_api_login "$E2E_DEMO_ARTIST_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "pro editor skipped — demo artist login failed"
    return 0
  fi

  local archive_json archive_id source_code draft_code projects_json stream_code bounce_code
  archive_json=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/archive" 2>/dev/null || echo '[]')

  if echo "$archive_json" | grep -q 'Live at Klubi'; then
    e2e_green "seeded archive item present for editor"
  else
    e2e_yellow "seeded archive missing — run seed-e2e-screenshots"
    return 0
  fi

  archive_id=$(echo "$archive_json" | node -e "
    const rows = JSON.parse(require('fs').readFileSync(0,'utf8'));
    const row = rows.find(r => (r.title||'').includes('Live at Klubi'));
    if (row) process.stdout.write(row.id);
  " 2>/dev/null || true)

  if [[ -z "$archive_id" ]]; then
    e2e_yellow "could not resolve archive item id"
    return 0
  fi

  source_code=$(e2e_http_code -b "$COOKIE_JAR" "$API_URL/api/me/archive/${archive_id}/editor/source" || echo '000')
  e2e_check_http "GET editor/source" '200' "$source_code"

  draft_code=$(e2e_http_code -b "$COOKIE_JAR" "$API_URL/api/me/archive/${archive_id}/editor/draft" || echo '000')
  e2e_check_http "GET editor/draft" '200' "$draft_code"

  if [[ "$draft_code" == "200" ]]; then
    local draft_body
    draft_body=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/archive/${archive_id}/editor/draft" 2>/dev/null || echo '{}')
    if echo "$draft_body" | grep -q '"editList"'; then
      e2e_green "EditList draft payload present"
    else
      e2e_red "EditList draft payload missing"
    fi
  fi

  stream_code=$(e2e_http_code -b "$COOKIE_JAR" "$API_URL/api/me/archive/${archive_id}/editor/stream" || echo '000')
  if [[ "$stream_code" == "200" ]]; then
    e2e_green "GET editor/stream (COEP same-origin)"
  elif [[ "$stream_code" == "500" || "$stream_code" == "502" ]]; then
    e2e_yellow "editor/stream returned $stream_code — MinIO/object storage may be unavailable in CI"
  else
    e2e_check_http "GET editor/stream (COEP same-origin)" '200' "$stream_code"
  fi

  bounce_code=$(e2e_http_code -b "$COOKIE_JAR" -X POST "$API_URL/api/me/archive/${archive_id}/editor/bounce" \
    -H 'Content-Type: application/json' \
    -d '{"startSec":0,"endSec":30,"versionLabel":"legacy","activate":true}' || echo '000')
  e2e_check_http "legacy editor/bounce returns 410 Gone" '410' "$bounce_code"

  projects_json=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/editor/projects" 2>/dev/null || echo '[]')
  if echo "$projects_json" | grep -q 'Live at Klubi'; then
    e2e_green "seeded multitrack editor project present"
  else
    e2e_yellow "no seeded editor project — optional"
  fi

  if e2e_app_reachable "/dashboard/editor"; then
    e2e_green "web: multitrack editor index"
  else
    e2e_yellow "web: editor index skipped"
  fi

  if [[ -n "$archive_id" ]] && e2e_app_reachable "/dashboard/archive/${archive_id}/editor"; then
    e2e_green "web: per-archive pro editor route"
  else
    e2e_yellow "web: pro editor route skipped"
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
  run_pro_audio_editor_journey
  e2e_summary "Pro audio editor journey" || exit 1
fi
