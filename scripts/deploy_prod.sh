#!/usr/bin/env bash
#
# Deploy the full Tahti stack to production (vimage, 192.168.2.100).
#
# Usage:
#   ./scripts/deploy_prod.sh               # sync, build, up
#   ./scripts/deploy_prod.sh --no-cache    # force full image rebuild
#   ./scripts/deploy_prod.sh --down        # stop the stack on prod
#
# Override targets:
#   DEPLOY_HOST   — SSH host alias (default: vimage → root@192.168.2.100)
#   DEPLOY_PATH   — remote project path (default: /srv/tahti)
#
set -euo pipefail

HOST="${DEPLOY_HOST:-vimage}"
REMOTE_PATH="${DEPLOY_PATH:-/srv/tahti}"

NO_CACHE=""
DOWN=""
for arg in "$@"; do
  case "$arg" in
    --no-cache) NO_CACHE=1 ;;
    --down)     DOWN=1 ;;
    -h|--help)  sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ssh_remote() { ssh "$HOST" "$@"; }

# ── Down ──────────────────────────────────────────────────────────────────────
if [[ -n "$DOWN" ]]; then
  echo "==> Stopping stack on ${HOST}"
  ssh_remote "cd '${REMOTE_PATH}' && docker compose -f infra/docker-compose.stack.yml down --remove-orphans"
  exit 0
fi

# ── Sync ──────────────────────────────────────────────────────────────────────
echo "==> Syncing code → ${HOST}:${REMOTE_PATH}"
ssh_remote "mkdir -p '${REMOTE_PATH}'"
rsync -az \
  --exclude .git \
  --exclude node_modules \
  --exclude .turbo \
  --exclude .next \
  --exclude dist \
  --exclude '*.mp4' \
  --exclude 'docs/e2e-screenshots/.seed-output.json' \
  ./ "${HOST}:${REMOTE_PATH}/"

# ── Build ─────────────────────────────────────────────────────────────────────
echo "==> Building images on ${HOST}"
BUILD_ARGS=()
[[ -n "$NO_CACHE" ]] && BUILD_ARGS+=(--no-cache)
ssh_remote "cd '${REMOTE_PATH}' && \
  docker compose -f infra/docker-compose.stack.yml build ${BUILD_ARGS[*]:-} api web worker orchestrator db-push"

# ── Up ────────────────────────────────────────────────────────────────────────
echo "==> Starting stack on ${HOST}"
ssh_remote "cd '${REMOTE_PATH}' && \
  docker compose -f infra/docker-compose.stack.yml up -d --remove-orphans"

# ── Health ────────────────────────────────────────────────────────────────────
echo "==> Waiting for API health..."
ssh_remote "for i in \$(seq 1 30); do
  curl -sf http://127.0.0.1:15011/health >/dev/null 2>&1 && echo '✓ API healthy' && break
  sleep 3
done"

echo "==> Waiting for Web..."
ssh_remote "for i in \$(seq 1 30); do
  curl -sf -o /dev/null http://127.0.0.1:17777/ 2>&1 && echo '✓ Web healthy' && break
  sleep 3
done"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Tahti stack deployed on ${HOST}"
echo "  API:  http://${HOST}:15011/health"
echo "  Web:  http://${HOST}:17777"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
