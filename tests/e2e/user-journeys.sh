#!/usr/bin/env bash
# User journey e2e — listener, artist, member, director, ops, and fan-supporter paths.
#
# Usage:
#   API_URL=http://localhost:3001 APP_URL=http://localhost:3010 bash tests/e2e/user-journeys.sh
#
# With seeded demo fixtures (recommended):
#   SEED_JOURNEY_FIXTURES=1 DATABASE_URL=postgres://... bash tests/e2e/user-journeys.sh
#
# Persona scripts (sourced below):
#   tests/e2e/journeys/listener.sh | artist.sh | member.sh | director.sh | ops.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=helpers.sh
source "$SCRIPT_DIR/helpers.sh"
# shellcheck source=journeys/fixtures.sh
source "$SCRIPT_DIR/journeys/fixtures.sh"
# shellcheck source=journeys/listener.sh
source "$SCRIPT_DIR/journeys/listener.sh"
# shellcheck source=journeys/artist.sh
source "$SCRIPT_DIR/journeys/artist.sh"
# shellcheck source=journeys/member.sh
source "$SCRIPT_DIR/journeys/member.sh"
# shellcheck source=journeys/dashboard-player.sh
source "$SCRIPT_DIR/journeys/dashboard-player.sh"
# shellcheck source=journeys/director.sh
source "$SCRIPT_DIR/journeys/director.sh"
# shellcheck source=journeys/ops.sh
source "$SCRIPT_DIR/journeys/ops.sh"
# shellcheck source=journeys/release-catalog.sh
source "$SCRIPT_DIR/journeys/release-catalog.sh"
# shellcheck source=journeys/pro-audio-editor.sh
source "$SCRIPT_DIR/journeys/pro-audio-editor.sh"

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

run_ops_journey
run_listener_journey
run_artist_journey
run_artist_subdomain_journey
run_streamer_journey
run_press_kit_journey
run_radio_slot_journey
run_member_journey
run_fan_supporter_journey
run_director_journey
run_dashboard_player_journey
run_release_catalog_journey
run_pro_audio_editor_journey

e2e_summary "User journey e2e" || exit 1
