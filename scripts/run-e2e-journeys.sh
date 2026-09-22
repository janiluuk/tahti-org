#!/usr/bin/env bash
# One-shot runner for the 4 category e2e journeys (anonymous, listener, artist,
# admin): brings up Postgres/Redis + the API + web dev servers if they aren't
# already running, seeds rich demo fixtures, then runs all 4 Playwright
# journeys (each captures light + dark screenshots at 3440x1440).
#
# Usage:
#   ./scripts/run-e2e-journeys.sh              # all 4 journeys
#   ./scripts/run-e2e-journeys.sh artist admin # only these journeys
#   ./scripts/run-e2e-journeys.sh --keep-up    # leave API/web running after
#
# This is the fast local-dev path (Postgres+Redis in Docker, API/web as plain
# `tsx`/`next dev` processes) — see docs/testing.md#e2e-journey-screenshots.
# For the full containerized stack instead, use ./scripts/stack-up.sh --seed
# + node tests/e2e/<category>/*.mjs directly.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export REDIS_PORT="${REDIS_PORT:-16379}"
export API_PORT="${API_PORT:-15011}"
export WEB_PORT="${WEB_PORT:-17777}"
export DATABASE_URL="postgresql://tahti:tahti_dev@localhost:${POSTGRES_PORT}/tahti"
export REDIS_URL="redis://localhost:${REDIS_PORT}"
export API_URL="http://localhost:${API_PORT}"
export APP_URL="http://localhost:${WEB_PORT}"

KEEP_UP=false
JOURNEYS=()
for arg in "$@"; do
  case "$arg" in
    --keep-up) KEEP_UP=true ;;
    anonymous|listener|artist|admin) JOURNEYS+=("$arg") ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done
[[ ${#JOURNEYS[@]} -eq 0 ]] && JOURNEYS=(anonymous listener artist admin)

STARTED_API_PID=""
STARTED_WEB_PID=""

cleanup() {
  if [[ "$KEEP_UP" == false ]]; then
    [[ -n "$STARTED_WEB_PID" ]] && kill "$STARTED_WEB_PID" 2>/dev/null || true
    [[ -n "$STARTED_API_PID" ]] && kill "$STARTED_API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "── E2E journey suite (anonymous / listener / artist / admin) ──"

echo "-- Postgres + Redis (Docker) --"
docker compose -f infra/docker-compose.dev.yml up postgres redis -d >/dev/null

echo "-- Prisma schema --"
pnpm --filter @tahti/db db:migrate:test >/dev/null

echo "-- api-client schema.d.ts (needed by apps/web) --"
pnpm --filter @tahti/api-client generate >/dev/null

if ! curl -sf "$API_URL/health" >/dev/null 2>&1; then
  echo "-- Starting API (apps/api, tsx src/index.ts) --"
  (
    cd apps/api
    PORT="$API_PORT" NODE_ENV=development HCAPTCHA_SECRET=dev \
      pnpm exec tsx src/index.ts > "$ROOT/docs/e2e-screenshots/.api-dev.log" 2>&1 &
    echo $! > "$ROOT/docs/e2e-screenshots/.api-dev.pid"
  )
  STARTED_API_PID="$(cat "$ROOT/docs/e2e-screenshots/.api-dev.pid")"
  for _ in $(seq 1 45); do
    curl -sf "$API_URL/health" >/dev/null 2>&1 && break
    sleep 1
  done
fi
curl -sf "$API_URL/health" >/dev/null || { echo "API did not become healthy" >&2; exit 1; }
echo "   API OK: $API_URL"

if ! curl -sf "$APP_URL/" >/dev/null 2>&1; then
  echo "-- Starting web (apps/web, next dev) --"
  (
    cd apps/web
    API_URL="$API_URL" NEXT_PUBLIC_API_BASE="$API_URL" NEXT_PUBLIC_API_URL="$API_URL" \
      NEXT_PUBLIC_APP_URL="$APP_URL" SIGNUP_OPEN=true \
      pnpm exec next dev -p "$WEB_PORT" > "$ROOT/docs/e2e-screenshots/.web-dev.log" 2>&1 &
    echo $! > "$ROOT/docs/e2e-screenshots/.web-dev.pid"
  )
  STARTED_WEB_PID="$(cat "$ROOT/docs/e2e-screenshots/.web-dev.pid")"
  for _ in $(seq 1 45); do
    curl -sf "$APP_URL/" >/dev/null 2>&1 && break
    sleep 1
  done
fi
curl -sf "$APP_URL/" >/dev/null || { echo "web did not become ready" >&2; exit 1; }
echo "   Web OK: $APP_URL"

echo "-- Seeding rich demo fixtures (screenshot-* accounts, catalog, archive) --"
(cd apps/api && pnpm exec tsx scripts/seed-e2e-screenshots.ts >/dev/null)
echo "   seeded"

status=0
for journey in "${JOURNEYS[@]}"; do
  echo ""
  echo "── ${journey} journey ──────────────────────────────────────"
  case "$journey" in
    anonymous) node tests/e2e/anonymous/anonymous-journey.mjs || status=1 ;;
    listener)  node tests/e2e/listener/listener-journey.mjs || status=1 ;;
    # E2E_SKIP_FRESH_RESET: the fresh-account DB reset shells out to the full
    # Docker stack (infra/docker-compose.stack.yml); this fast local-dev path
    # only runs Postgres/Redis via docker-compose.dev.yml, so skip it here —
    # the script already tolerates a non-fresh account (existing channel).
    artist)    E2E_SKIP_FRESH_RESET=1 node tests/e2e/artist/fresh-artist-journey.mjs || status=1 ;;
    admin)     node tests/e2e/admin/admin-journey.mjs || status=1 ;;
  esac
done

echo ""
echo "── Screenshots ──────────────────────────────────────────────"
for journey in "${JOURNEYS[@]}"; do
  echo "   docs/e2e-screenshots/${journey}/journey/{light,dark}/"
done

exit $status
