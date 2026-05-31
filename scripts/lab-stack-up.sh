#!/usr/bin/env bash
#
# Build and deploy the Tahti website to the lab host via rsync + docker compose.
#
#   ./scripts/lab-stack-up.sh
#   ./scripts/lab-stack-up.sh --no-cache
#   RSYNC_DELETE=1 ./scripts/lab-stack-up.sh
#
# Env (defaults suit 192.168.2.100 lab):
#   LAB_HOST / DEPLOY_HOST   — default 192.168.2.100
#   LAB_PATH / DEPLOY_PATH   — default /srv/tahti
#   LAB_USER / DEPLOY_USER   — default root
#   SSH_PROXY_JUMP           — e.g. pi@sparkki.dudeisland.eu:4322 (GitHub Actions / remote deploy)
#   DEPLOY_APP_PORT          — default 8090
#
# NOTE: website/output_vhs.mp4 is not tracked in git. It is preserved across
#       deployments because rsync does not run --delete. For a fresh server,
#       copy it once manually:
#         scp website/output_vhs.mp4 root@192.168.2.100:/srv/tahti/website/
#
set -euo pipefail

NO_CACHE=""
for arg in "$@"; do
  case "$arg" in
    --no-cache) NO_CACHE=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
  esac
done

HOST="${LAB_HOST:-${DEPLOY_HOST:-192.168.2.100}}"
REMOTE_PATH="${LAB_PATH:-${DEPLOY_PATH:-/srv/tahti}}"
REMOTE_USER="${LAB_USER:-${DEPLOY_USER:-root}}"
PROXY_JUMP="${SSH_PROXY_JUMP:-}"
APP_PORT="${DEPLOY_APP_PORT:-8090}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
if [[ -n "$PROXY_JUMP" ]]; then
  SSH_OPTS+=(-J "$PROXY_JUMP")
fi
ssh_remote() {
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${HOST}" "$@"
}
RSYNC_RSH="ssh"
for opt in "${SSH_OPTS[@]}"; do
  RSYNC_RSH+=" $(printf '%q' "$opt")"
done

RSYNC_FLAGS=(-az)
if [[ "${RSYNC_DELETE:-}" == "1" ]]; then
  RSYNC_FLAGS+=(--delete)
fi

# --- 1. Tear down old stack ---
echo "==> Remote: tear down"
ssh_remote "[ -d '${REMOTE_PATH}' ] && cd '${REMOTE_PATH}' && docker compose down --remove-orphans 2>/dev/null || true"

# --- 2. Sync project files ---
# *.mp4 is excluded: not in git, but preserved on the server between deploys.
echo "==> Sync → ${REMOTE_USER}@${HOST}:${REMOTE_PATH}"
ssh_remote "mkdir -p '${REMOTE_PATH}'"
rsync "${RSYNC_FLAGS[@]}" \
  -e "$RSYNC_RSH" \
  --exclude .git \
  --exclude '*.mp4' \
  --exclude node_modules \
  ./ "${REMOTE_USER}@${HOST}:${REMOTE_PATH}/"

# --- 3. Build image on remote and start ---
BUILD_CMD="docker compose build --pull"
[[ -n "$NO_CACHE" ]] && BUILD_CMD+=" --no-cache"

echo "==> Remote: ${BUILD_CMD} → docker compose up -d"
ssh_remote "set -e; cd '${REMOTE_PATH}'; ${BUILD_CMD}; docker compose up -d"

BASE_URL="http://${HOST}:${APP_PORT}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Website: ${BASE_URL}"
echo "  Health:  ${BASE_URL}/health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
