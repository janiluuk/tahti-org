#!/usr/bin/env bash
#
# Deploy the full Tahti Docker stack to a remote host (rsync + stack-up.sh on server).
#
#   ./scripts/remote-stack-deploy.sh
#   ./scripts/remote-stack-deploy.sh --seed
#   ./scripts/remote-stack-deploy.sh --no-cache
#
# Env (defaults suit lab at 192.168.2.100):
#   LAB_HOST / DEPLOY_HOST     — default 192.168.2.100
#   LAB_PATH / DEPLOY_PATH     — default /srv/tahti
#   LAB_USER / DEPLOY_USER     — default root
#   SSH_PROXY_JUMP             — e.g. pi@sparkki.dudeisland.eu:4322
#   WEB_PORT                   — default 3010 (host publish for web)
#   API_PORT                   — default 3011 (host publish for api)
#
set -euo pipefail

NO_CACHE=""
SEED=""
for arg in "$@"; do
  case "$arg" in
    --no-cache) NO_CACHE=1 ;;
    --seed) SEED=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
  esac
done

HOST="${LAB_HOST:-${DEPLOY_HOST:-192.168.2.100}}"
REMOTE_PATH="${LAB_PATH:-${DEPLOY_PATH:-/srv/tahti}}"
REMOTE_USER="${LAB_USER:-${DEPLOY_USER:-root}}"
PROXY_JUMP="${SSH_PROXY_JUMP:-}"
WEB_PORT="${WEB_PORT:-3010}"
API_PORT="${API_PORT:-3011}"

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

echo "==> Remote: stop existing stack (if any)"
ssh_remote "cd '${REMOTE_PATH}' 2>/dev/null && WEB_PORT=${WEB_PORT} API_PORT=${API_PORT} ./scripts/stack-up.sh --down 2>/dev/null || true"

echo "==> Sync → ${REMOTE_USER}@${HOST}:${REMOTE_PATH}"
ssh_remote "mkdir -p '${REMOTE_PATH}'"
rsync "${RSYNC_FLAGS[@]}" \
  -e "$RSYNC_RSH" \
  --exclude .git \
  --exclude node_modules \
  --exclude .turbo \
  --exclude .next \
  --exclude dist \
  --exclude 'docs/e2e-screenshots/.seed-output.json' \
  --exclude '*.mp4' \
  ./ "${REMOTE_USER}@${HOST}:${REMOTE_PATH}/"

STACK_ARGS=()
[[ -n "$SEED" ]] && STACK_ARGS+=(--seed)
[[ -n "$NO_CACHE" ]] && STACK_ARGS+=(--no-cache)

echo "==> Remote: stack-up (build + start)"
ssh_remote "set -euo pipefail
  cd '${REMOTE_PATH}'
  export WEB_PORT=${WEB_PORT} API_PORT=${API_PORT}
  ./scripts/stack-up.sh ${STACK_ARGS[*]}"

echo "==> Health checks on remote"
ssh_remote "curl -sf http://127.0.0.1:${API_PORT}/health"
ssh_remote "curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:${WEB_PORT}/ | grep -q 200"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Full stack deployed on ${HOST}"
echo "  Web:  http://${HOST}:${WEB_PORT}"
echo "  API:  http://${HOST}:${API_PORT}/health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
