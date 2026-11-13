#!/usr/bin/env bash
#
# Scoped rebuild of the stack worker + cron-runner on production (vimage).
# Use after merging worker lane/handoff or cron fixes when a full
# ./scripts/deploy_prod.sh bounce is unnecessary.
#
# Also rebuilds the remote transcode worker on vimage7 (ffmpeg lane).
#
# Usage:
#   ./scripts/redeploy-media-workers.sh
#   ./scripts/redeploy-media-workers.sh --skip-transcode
#   DEPLOY_HOST=vimage ./scripts/redeploy-media-workers.sh
#
set -euo pipefail

HOST="${DEPLOY_HOST:-vimage}"
REMOTE_PATH="${DEPLOY_PATH:-/srv/tahti}"
SKIP_TRANSCODE=0
for arg in "$@"; do
  case "$arg" in
    --skip-transcode) SKIP_TRANSCODE=1 ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
RELEASE_VERSION="${RELEASE_VERSION:-$(git rev-parse --short HEAD)}"

ssh_remote() { ssh -o BatchMode=yes "$HOST" "$@"; }

echo "==> Syncing code → ${HOST}:${REMOTE_PATH}"
ssh_remote "mkdir -p '${REMOTE_PATH}'"
rsync -az --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude .turbo \
  --exclude .next \
  --exclude dist \
  --exclude infra/stack.env \
  --exclude infra/stack.env.backups \
  --exclude 'infra/stack.env.swarm-*' \
  --exclude infra/icecast.xml \
  --exclude infra/icecast-b.xml \
  ./ "${HOST}:${REMOTE_PATH}/"

COMPOSE=(docker compose -f infra/docker-compose.stack.yml)
if ssh_remote "test -f '${REMOTE_PATH}/infra/stack.env'"; then
  COMPOSE+=(--env-file infra/stack.env)
fi

echo "==> Building worker + cron-runner on ${HOST} (${RELEASE_VERSION})"
ssh_remote "cd '${REMOTE_PATH}' && \
  RELEASE_VERSION='${RELEASE_VERSION}' ${COMPOSE[*]} build worker cron-runner"

echo "==> Restarting worker + cron-runner (no other services)"
ssh_remote "cd '${REMOTE_PATH}' && \
  RELEASE_VERSION='${RELEASE_VERSION}' ${COMPOSE[*]} up -d --no-deps --remove-orphans worker cron-runner"

echo "==> Recent worker / cron-runner logs"
ssh_remote "cd '${REMOTE_PATH}' && ${COMPOSE[*]} logs --tail 30 worker cron-runner" || true

if [[ "$SKIP_TRANSCODE" -eq 0 ]]; then
  echo "==> Redeploying remote transcode worker (vimage7)"
  bash "$ROOT/scripts/deploy_worker_remote.sh"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Media workers redeployed (${RELEASE_VERSION})"
echo "  Next: GET /api/admin/workers (laneCoverage) and"
echo "        ./scripts/recover-stuck-sound-transcodes.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
