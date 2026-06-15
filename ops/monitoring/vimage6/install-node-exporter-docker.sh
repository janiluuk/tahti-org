#!/usr/bin/env bash
# Run node_exporter in Docker with optional NVIDIA textfile collector mount.
#
#   ./ops/monitoring/vimage6/install-node-exporter-docker.sh jani@192.168.2.102
#
set -euo pipefail

TARGET="${1:?usage: $0 user@host}"
IMAGE="${NODE_EXPORTER_IMAGE:-prom/node-exporter:v1.8.2}"

echo "==> node_exporter (Docker) on ${TARGET}"
ssh "$TARGET" "IMAGE='${IMAGE}' bash -s" <<'REMOTE'
set -euo pipefail
TEXTFILE_VOL=""
TEXTFILE_ARG=""
if [[ -d /opt/nvidia-metrics ]]; then
  TEXTFILE_VOL="-v /opt/nvidia-metrics:/textfile:ro"
  TEXTFILE_ARG="--collector.textfile.directory=/textfile"
elif [[ -d "${HOME}/nvidia-metrics" ]]; then
  TEXTFILE_VOL="-v ${HOME}/nvidia-metrics:/textfile:ro"
  TEXTFILE_ARG="--collector.textfile.directory=/textfile"
fi

docker rm -f node-exporter 2>/dev/null || true
# shellcheck disable=SC2086
docker run -d --name node-exporter --restart unless-stopped --net host \
  -v /:/host:ro,rslave \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  ${TEXTFILE_VOL} \
  "${IMAGE}" \
  --path.rootfs=/host \
  --path.procfs=/host/proc \
  --path.sysfs=/host/sys \
  --collector.filesystem.mount-points-exclude='^/(sys|proc|dev|host|etc)($|/)' \
  ${TEXTFILE_ARG}

curl -sf http://127.0.0.1:9100/metrics | head -2
REMOTE

echo "OK: node_exporter on ${TARGET}"
