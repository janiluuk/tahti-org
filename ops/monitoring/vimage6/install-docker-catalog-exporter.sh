#!/usr/bin/env bash
# Install docker-catalog Prometheus exporter on a LAN host (port 9096, host network).
#
#   ./ops/monitoring/vimage6/install-docker-catalog-exporter.sh jani@192.168.2.103 vimage4
#   ./ops/monitoring/vimage6/install-docker-catalog-exporter.sh root@192.168.2.100 vimage
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
V6="${ROOT}/ops/monitoring/vimage6"
TARGET="${1:?usage: $0 user@host instance-name}"
INSTANCE="${2:?usage: $0 user@host instance-name}"
HOST_IP="${3:-$(echo "$TARGET" | sed -n 's/.*@\([0-9.]*\).*/\1/p')}"

if [[ -z "$HOST_IP" ]]; then
  echo "Could not infer HOST_IP; pass as third argument" >&2
  exit 1
fi

echo "==> Install docker-catalog-exporter on ${TARGET} (${INSTANCE}, ${HOST_IP})"
ssh "$TARGET" "sudo mkdir -p /opt/monitoring/bin /opt/monitoring/docker-catalog"
scp "${V6}/docker-catalog-exporter.py" "${TARGET}:/tmp/docker-catalog-exporter.py"
scp "${V6}/docker-catalog-url-overrides.json" "${TARGET}:/tmp/url-overrides.json"
ssh "$TARGET" "sudo mv /tmp/docker-catalog-exporter.py /opt/monitoring/bin/docker-catalog-exporter.py
  sudo mv /tmp/url-overrides.json /opt/monitoring/docker-catalog/url-overrides.json
  sudo chmod 755 /opt/monitoring/bin/docker-catalog-exporter.py"

ssh "$TARGET" "docker rm -f docker-catalog-exporter 2>/dev/null || true
  docker run -d --name docker-catalog-exporter --restart unless-stopped \
    --network host \
    -e HOST_NAME=${INSTANCE} \
    -e HOST_IP=${HOST_IP} \
    -e URL_OVERRIDES=/etc/docker-catalog/url-overrides.json \
    -v /var/run/docker.sock:/var/run/docker.sock:ro \
    -v /opt/monitoring/docker-catalog:/etc/docker-catalog:ro \
    -v /opt/monitoring/bin/docker-catalog-exporter.py:/app/exporter.py:ro \
    python:3-alpine python /app/exporter.py"

echo "==> Verify"
ssh "$TARGET" "curl -sf http://127.0.0.1:9096/metrics | head -3"
echo "OK: docker-catalog-exporter on ${INSTANCE}"
