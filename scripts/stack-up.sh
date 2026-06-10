#!/usr/bin/env bash
# Bring up the full Tahti stack in Docker (infra + api + web + worker + orchestrator).
#
# Usage:
#   ./scripts/stack-up.sh          # build, migrate, start, wait for health
#   ./scripts/stack-up.sh --seed   # also load screenshot demo fixtures
#   ./scripts/stack-up.sh --down   # tear down the stack
#   ./scripts/stack-up.sh --no-cache  # rebuild images without cache
#
# After up:
#   App:     http://localhost:${WEB_PORT:-17777}
#   API:     http://localhost:${API_PORT:-15011}
#   MailHog: http://localhost:${MAILHOG_UI_PORT:-18025}

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker-compose.stack.yml"
COMPOSE=(docker compose -f "$COMPOSE_FILE")

# All stack ports live above 15 000 to avoid clashing with any host dev service.
export WEB_PORT="${WEB_PORT:-17777}"
export API_PORT="${API_PORT:-15011}"
SEED=false
DOWN=false
NO_CACHE=false

for arg in "$@"; do
  case "$arg" in
    --seed) SEED=true ;;
    --down) DOWN=true ;;
    --no-cache) NO_CACHE=true ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ "$DOWN" == true ]]; then
  "${COMPOSE[@]}" down --remove-orphans
  echo "Stack stopped."
  exit 0
fi

echo "── Building images (first run may take several minutes) ──"
BUILD_ARGS=()
[[ "$NO_CACHE" == true ]] && BUILD_ARGS+=(--no-cache)
"${COMPOSE[@]}" build "${BUILD_ARGS[@]}" api web worker orchestrator db-push

echo "── Starting stack ──"
"${COMPOSE[@]}" up -d postgres pgbouncer redis minio mailhog chat icecast rtmp-ingest
"${COMPOSE[@]}" up -d minio-init db-push
"${COMPOSE[@]}" up -d api worker orchestrator web

wait_for() {
  local url="$1"
  local label="$2"
  local tries="${3:-90}"
  for ((i = 1; i <= tries; i++)); do
    if curl -sf "$url" &>/dev/null; then
      echo "✓ $label ready ($url)"
      return 0
    fi
    sleep 2
  done
  echo "✗ Timed out waiting for $label at $url" >&2
  "${COMPOSE[@]}" ps
  return 1
}

wait_for "http://localhost:${API_PORT:-15011}/health" "API"
wait_for "http://localhost:${WEB_PORT:-17777}/" "Web"

echo "── Seeding Tahti Radio channel (chat) ──"
"${COMPOSE[@]}" run --rm --no-deps \
  -e DATABASE_URL=postgresql://tahti:tahti_dev@postgres:5432/tahti \
  -w /app \
  api tsx apps/api/scripts/seed-tahti-radio.ts >/dev/null

if [[ "$SEED" == true ]]; then
  echo "── Seeding screenshot fixtures ──"
  mkdir -p "$ROOT/docs/e2e-screenshots"
  "${COMPOSE[@]}" run --rm --no-deps \
    -e DATABASE_URL=postgresql://tahti:tahti_dev@postgres:5432/tahti \
    -w /app \
    api tsx apps/api/scripts/seed-e2e-screenshots.ts 2>/dev/null > "$ROOT/docs/e2e-screenshots/.seed-output.json"
  echo "Fixtures seeded. Token in docs/e2e-screenshots/.seed-output.json"
fi

echo ""
echo "── Tahti stack is up ─────────────────────────────────────"
echo "   Web app:  http://localhost:${WEB_PORT:-17777}"
echo "   API:      http://localhost:${API_PORT:-15011}/health"
echo "   MailHog:  http://localhost:${MAILHOG_UI_PORT:-18025}"
echo "   MinIO UI: http://localhost:${MINIO_CONSOLE_PORT:-19001}"
echo ""
echo "   Screenshots (local): ./scripts/e2e-screenshots.sh"
echo "   Stop:        ./scripts/stack-up.sh --down"
