#!/usr/bin/env bash
#
# Deploy the remote transcode worker + GPU stem-separator to a LAN box
# (default: jani@vimage7.local — the only box in the fleet with a GPU).
#
# One-time host prerequisite for stem-separator (not this script's job):
#   sudo apt-get install -y nvidia-container-toolkit
#   sudo nvidia-ctk runtime configure --runtime=docker
#   sudo systemctl restart docker
# Without it, only stem-separator fails to start (GPU device unavailable) —
# worker-transcode has no depends_on on it and starts independently either
# way, matching the existing "not required to boot" resilience design.
#
# Usage:
#   ./scripts/deploy_worker_remote.sh
#   REMOTE_HOST=jani@vimage7.local REMOTE_PATH=/srv/tahti-worker ./scripts/deploy_worker_remote.sh
#   ./scripts/deploy_worker_remote.sh --bootstrap-env   # copy secrets from vimage stack.env
#
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-jani@vimage7.local}"
REMOTE_PATH="${REMOTE_PATH:-$HOME/tahti-worker}"
VIMAGE_HOST="${VIMAGE_HOST:-vimage}"
BOOTSTRAP_ENV=0

for arg in "$@"; do
  case "$arg" in
    --bootstrap-env) BOOTSTRAP_ENV=1 ;;
    -h|--help)
      sed -n '2,17p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ssh_remote() { ssh "$REMOTE_HOST" "$@"; }

echo "==> Syncing worker code → ${REMOTE_HOST}:${REMOTE_PATH}"
ssh_remote "mkdir -p '${REMOTE_PATH}'"
rsync -az --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude .turbo \
  --exclude .next \
  --exclude dist \
  --exclude infra/stack.env \
  --exclude infra/stack.env.worker-remote \
  ./ "${REMOTE_HOST}:${REMOTE_PATH}/"

ENV_FILE="infra/stack.env.worker-remote"
if [[ "$BOOTSTRAP_ENV" -eq 1 ]]; then
  echo "==> Bootstrapping ${ENV_FILE} from ${VIMAGE_HOST} infra/stack.env"
  ssh "$VIMAGE_HOST" "test -f /srv/tahti/infra/stack.env" || {
    echo "Missing /srv/tahti/infra/stack.env on ${VIMAGE_HOST}" >&2
    exit 1
  }
  # shellcheck disable=SC2029
  ssh "$VIMAGE_HOST" 'set -a; . /srv/tahti/infra/stack.env; set +a
    PG="${POSTGRES_PASSWORD:-tahti_dev}"
    MINIO="${MINIO_SECRET_KEY:-local-stack-minio-secret}"
    INT="${INTERNAL_SECRET:-local-stack-internal-secret}"
    RTMP="${RTMP_KEY_ENC_KEY:-abababababababababababababababababababababababababababababababab}"
    printf "%s\n" \
      "DATABASE_URL=postgresql://tahti:${PG}@192.168.2.100:5432/tahti?pgbouncer=true" \
      "REDIS_URL=redis://192.168.2.100:6379" \
      "MINIO_ENDPOINT=http://192.168.2.100:19000" \
      "MINIO_PUBLIC_ENDPOINT=http://192.168.2.100:19000" \
      "MINIO_ACCESS_KEY=tahti" \
      "MINIO_SECRET_KEY=${MINIO}" \
      "INTERNAL_SECRET=${INT}" \
      "RTMP_KEY_ENC_KEY=${RTMP}" \
      "WORKER_CONCURRENCY=4"
      # No STEM_SEPARATOR_URL here — docker-compose.worker-remote.yml sets it
      # to the colocated stem-separator service directly, not from env.
  ' > /tmp/tahti-worker-remote.env
  scp /tmp/tahti-worker-remote.env "${REMOTE_HOST}:${REMOTE_PATH}/${ENV_FILE}"
  rm -f /tmp/tahti-worker-remote.env
  ssh_remote "chmod 600 '${REMOTE_PATH}/${ENV_FILE}'"
elif ! ssh_remote "test -f '${REMOTE_PATH}/${ENV_FILE}'"; then
  echo "==> WARN: ${ENV_FILE} not found on remote."
  echo "    Run with --bootstrap-env or copy infra/stack.env.worker-remote.example"
  exit 1
fi

echo "==> Building worker-transcode image on ${REMOTE_HOST}"
DOCKER="${DOCKER_CMD:-docker}"
if ! ssh_remote "docker info >/dev/null 2>&1"; then
  if ssh_remote "sudo -n docker info >/dev/null 2>&1"; then
    DOCKER="sudo docker"
  else
    echo "ERROR: docker not usable on ${REMOTE_HOST} (add user to docker group: sudo usermod -aG docker \$USER)" >&2
    exit 1
  fi
fi
ssh_remote "cd '${REMOTE_PATH}' && ${DOCKER} compose -f infra/docker-compose.worker-remote.yml --env-file ${ENV_FILE} build worker-transcode"

echo "==> Building stem-separator image on ${REMOTE_HOST} (large — torch + two baked-in models)"
ssh_remote "cd '${REMOTE_PATH}' && ${DOCKER} compose -f infra/docker-compose.worker-remote.yml --env-file ${ENV_FILE} build stem-separator"

echo "==> Starting worker-transcode on ${REMOTE_HOST}"
ssh_remote "cd '${REMOTE_PATH}' && ${DOCKER} compose -f infra/docker-compose.worker-remote.yml --env-file ${ENV_FILE} up -d --remove-orphans worker-transcode"

# Best-effort: no `set -e` abort here — a missing NVIDIA Container Toolkit
# fails only this service (worker-transcode above is unaffected, no
# depends_on between them), and that's a one-time host setup step this
# script doesn't perform. See the header comment.
echo "==> Starting stem-separator on ${REMOTE_HOST}"
if ! ssh_remote "cd '${REMOTE_PATH}' && ${DOCKER} compose -f infra/docker-compose.worker-remote.yml --env-file ${ENV_FILE} up -d stem-separator"; then
  echo "==> WARN: stem-separator failed to start — likely the NVIDIA Container Toolkit isn't installed on ${REMOTE_HOST} yet (see this script's header comment). worker-transcode is unaffected."
fi

echo "==> Remote logs (last 20 lines each)"
ssh_remote "cd '${REMOTE_PATH}' && ${DOCKER} compose -f infra/docker-compose.worker-remote.yml logs --tail 20 worker-transcode stem-separator" || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Transcode worker + stem-separator deployed on ${REMOTE_HOST}"
echo "  Lane: transcode (ffmpeg archive/release jobs, separate-stems)"
echo "  Queue/redis: 192.168.2.100:6379"
echo "  Stem-separator: http://${REMOTE_HOST#*@}:8090/health (GPU — check the log above for CUDA errors)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
