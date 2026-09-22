#!/usr/bin/env bash
# User journey e2e — listener, artist, member, director, ops, and fan-supporter paths.
#
# Usage:
#   API_URL=http://localhost:3001 APP_URL=http://localhost:3010 bash tests/e2e/user-journeys.sh
#
# With seeded demo fixtures (recommended):
#   SEED_JOURNEY_FIXTURES=1 DATABASE_URL=postgres://... bash tests/e2e/user-journeys.sh
#
# Persona scripts (sourced below) are grouped into 4 e2e categories:
#   anonymous/  — unauthenticated visitor (public discovery, health/status)
#   listener/   — verified/member account without a channel (governance, social)
#   artist/     — channel owner (studio APIs, catalog, streaming, editor)
#   admin/      — board/director console

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=helpers.sh
source "$SCRIPT_DIR/helpers.sh"
# shellcheck source=journeys-fixtures.sh
source "$SCRIPT_DIR/journeys-fixtures.sh"
# shellcheck source=anonymous/ops-health.sh
source "$SCRIPT_DIR/anonymous/ops-health.sh"
# shellcheck source=anonymous/public-discovery.sh
source "$SCRIPT_DIR/anonymous/public-discovery.sh"
# shellcheck source=listener/member-governance.sh
source "$SCRIPT_DIR/listener/member-governance.sh"
# shellcheck source=artist/artist.sh
source "$SCRIPT_DIR/artist/artist.sh"
# shellcheck source=artist/release-catalog.sh
source "$SCRIPT_DIR/artist/release-catalog.sh"
# shellcheck source=artist/pro-audio-editor.sh
source "$SCRIPT_DIR/artist/pro-audio-editor.sh"
# shellcheck source=admin/director.sh
source "$SCRIPT_DIR/admin/director.sh"

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
elif curl -sf "$API_URL/api/v1/u/${E2E_DEMO_ARTIST_USER}/profile" 2>/dev/null | grep -q '"username"'; then
  e2e_green "Demo artist profile present (pre-seeded)"
else
  e2e_yellow "Demo fixtures missing — set SEED_JOURNEY_FIXTURES=1 or run stack --seed"
fi

# ── anonymous ────────────────────────────────────────────────
run_ops_journey
run_listener_journey

# ── listener (verified/member, no channel) ────────────────────
run_member_journey
run_feature_request_journey
run_fan_supporter_journey

# ── artist ──────────────────────────────────────────────────
run_artist_journey
run_artist_player_journey
run_artist_subdomain_journey
run_streamer_journey
run_press_kit_journey
run_radio_slot_journey
run_release_catalog_journey
run_pro_audio_editor_journey

# ── admin ───────────────────────────────────────────────────
run_director_journey

e2e_summary "User journey e2e" || exit 1
