#!/usr/bin/env bash
#
# Deploy the remote MinIO storage node to tahti.local (5-disk erasure-coded
# pool at /mnt/minio/disk{1..5} — see docs/todo/tahti-local-onboarding.md
# for the disk-prep steps).
#
# Unlike deploy_worker_remote.sh, nothing here is built from source — MinIO
# is a pulled image (quay.io/minio/minio:latest) — so only the compose file
# and env file need to reach the remote host.
#
# Usage:
#   ./scripts/deploy_minio_remote.sh
#   REMOTE_HOST=jani@tahti.local REMOTE_PATH=/srv/tahti-minio ./scripts/deploy_minio_remote.sh
#   ./scripts/deploy_minio_remote.sh --bootstrap-env   # copy MINIO_SECRET_KEY from vimage stack.env
#
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-jani@tahti.local}"
REMOTE_PATH="${REMOTE_PATH:-$HOME/tahti-minio}"
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

echo "==> Syncing compose files → ${REMOTE_HOST}:${REMOTE_PATH}"
ssh_remote "mkdir -p '${REMOTE_PATH}/infra'"
scp infra/docker-compose.minio-remote.yml "${REMOTE_HOST}:${REMOTE_PATH}/infra/"

ENV_FILE="infra/stack.env.minio-remote"
if [[ "$BOOTSTRAP_ENV" -eq 1 ]]; then
  echo "==> Bootstrapping ${ENV_FILE} from ${VIMAGE_HOST} infra/stack.env"
  ssh "$VIMAGE_HOST" "test -f /srv/tahti/infra/stack.env" || {
    echo "Missing /srv/tahti/infra/stack.env on ${VIMAGE_HOST}" >&2
    exit 1
  }
  # shellcheck disable=SC2029
  ssh "$VIMAGE_HOST" 'set -a; . /srv/tahti/infra/stack.env; set +a
    MINIO="${MINIO_SECRET_KEY:-local-stack-minio-secret}"
    printf "%s\n" \
      "MINIO_ROOT_USER=tahti" \
      "MINIO_SECRET_KEY=${MINIO}" \
      "MINIO_PORT=9000" \
      "MINIO_CONSOLE_PORT=9001"
  ' > /tmp/tahti-minio-remote.env
  scp /tmp/tahti-minio-remote.env "${REMOTE_HOST}:${REMOTE_PATH}/${ENV_FILE}"
  rm -f /tmp/tahti-minio-remote.env
  ssh_remote "chmod 600 '${REMOTE_PATH}/${ENV_FILE}'"
elif ! ssh_remote "test -f '${REMOTE_PATH}/${ENV_FILE}'"; then
  echo "==> WARN: ${ENV_FILE} not found on remote."
  echo "    Run with --bootstrap-env or copy infra/stack.env.minio-remote.example"
  exit 1
fi

DOCKER="${DOCKER_CMD:-docker}"
if ! ssh_remote "docker info >/dev/null 2>&1"; then
  if ssh_remote "sudo -n docker info >/dev/null 2>&1"; then
    DOCKER="sudo docker"
  else
    echo "ERROR: docker not usable on ${REMOTE_HOST} (add user to docker group: sudo usermod -aG docker \$USER, then re-login)" >&2
    exit 1
  fi
fi

echo "==> Pulling + starting minio on ${REMOTE_HOST}"
ssh_remote "cd '${REMOTE_PATH}' && ${DOCKER} compose -f infra/docker-compose.minio-remote.yml --env-file ${ENV_FILE} up -d --remove-orphans minio"

echo "==> Remote logs (last 20 lines)"
ssh_remote "cd '${REMOTE_PATH}' && ${DOCKER} compose -f infra/docker-compose.minio-remote.yml logs --tail 20 minio" || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MinIO deployed on ${REMOTE_HOST}"
echo "  S3 API:  http://${REMOTE_HOST#*@}:9000"
echo "  Console: http://${REMOTE_HOST#*@}:9001"
echo "  Data on host (bind-mounted, browsable directly, not a Docker volume):"
echo "    /mnt/minio/disk{1..5} on ${REMOTE_HOST}"
echo "  Not yet migrated from vimage or cut over — this is a standalone"
echo "  instance until docs/todo/tahti-local-onboarding.md's mc mirror +"
echo "  cutover steps run."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
