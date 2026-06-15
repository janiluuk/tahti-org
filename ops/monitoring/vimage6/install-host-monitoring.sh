#!/usr/bin/env bash
# Install node_exporter + cAdvisor + docker-catalog on a fleet host.
# Docker agents use --restart unless-stopped and a systemd helper that re-runs
# after docker.service starts (so monitoring comes up with Docker).
#
#   ./ops/monitoring/vimage6/install-host-monitoring.sh jani@192.168.2.102 vimage3
#   ./ops/monitoring/vimage6/install-host-monitoring.sh jani@192.168.2.102 vimage3 192.168.2.102 8081
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
V6="${ROOT}/ops/monitoring/vimage6"
TARGET="${1:?usage: $0 user@host instance-name [host-ip] [cadvisor-port]}"
INSTANCE="${2:?usage: $0 user@host instance-name [host-ip] [cadvisor-port]}"
HOST_IP="${3:-$(echo "$TARGET" | sed -n 's/.*@\([0-9.]*\).*/\1/p')}"
CADVISOR_PORT="${4:-8081}"

if [[ -z "$HOST_IP" ]]; then
  echo "Could not infer HOST_IP; pass as third argument" >&2
  exit 1
fi

echo "==> node_exporter on ${TARGET}"
if ssh "$TARGET" "sudo -n true 2>/dev/null"; then
  ssh "$TARGET" "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y prometheus-node-exporter"
  ssh "$TARGET" "sudo systemctl enable --now prometheus-node-exporter"
else
  echo "    (no passwordless sudo — using Docker node-exporter)"
  if ssh "$TARGET" "command -v nvidia-smi >/dev/null 2>&1"; then
    "${V6}/install-nvidia-gpu-metrics.sh" "$TARGET"
  fi
  "${V6}/install-node-exporter-docker.sh" "$TARGET"
fi
ssh "$TARGET" "curl -sf http://127.0.0.1:9100/metrics | head -2"

echo "==> cAdvisor on ${TARGET}:${CADVISOR_PORT}"
ssh "$TARGET" "docker rm -f cadvisor 2>/dev/null || true
  docker run -d --name cadvisor --restart unless-stopped \
    --volume=/:/rootfs:ro \
    --volume=/var/run:/var/run:ro \
    --volume=/sys:/sys:ro \
    --volume=/var/lib/docker/:/var/lib/docker:ro \
    --device=/dev/kmsg \
    --publish ${CADVISOR_PORT}:8080 \
    gcr.io/cadvisor/cadvisor:v0.49.1"
ssh "$TARGET" "curl -sf http://127.0.0.1:${CADVISOR_PORT}/metrics | head -2"

echo "==> docker-catalog exporter on ${TARGET}"
"${V6}/install-docker-catalog-exporter.sh" "$TARGET" "$INSTANCE" "$HOST_IP"

if ssh "$TARGET" "sudo -n true 2>/dev/null"; then
  echo "==> systemd helper (start monitoring agents after docker)"
  ssh "$TARGET" "sudo mkdir -p /opt/monitoring/bin"
  scp "${V6}/ensure-docker-monitoring-agents.sh" "${TARGET}:/tmp/ensure-docker-monitoring-agents.sh"
  ssh "$TARGET" "sudo mv /tmp/ensure-docker-monitoring-agents.sh /opt/monitoring/bin/ensure-docker-monitoring-agents.sh
    sudo chmod 755 /opt/monitoring/bin/ensure-docker-monitoring-agents.sh
    sudo tee /etc/systemd/system/monitoring-docker-agents.service >/dev/null <<UNIT
[Unit]
Description=Ensure Prometheus docker monitoring agents (cAdvisor, docker-catalog)
After=docker.service
Wants=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
Environment=INSTANCE_NAME=${INSTANCE}
Environment=HOST_IP=${HOST_IP}
Environment=CADVISOR_PORT=${CADVISOR_PORT}
ExecStart=/opt/monitoring/bin/ensure-docker-monitoring-agents.sh

[Install]
WantedBy=multi-user.target docker.service
UNIT
    sudo systemctl daemon-reload
    sudo systemctl enable --now monitoring-docker-agents.service"
else
  echo "    (no passwordless sudo — docker --restart unless-stopped on agents is sufficient)"
fi

echo "OK: host monitoring on ${INSTANCE} (${HOST_IP}) — node :9100, cadvisor :${CADVISOR_PORT}, catalog :9096"
