#!/usr/bin/env bash
# Install nvidia-smi → textfile metrics loop + systemd timer on a GPU host.
#
#   ./ops/monitoring/vimage6/install-nvidia-gpu-metrics.sh jani@192.168.2.102
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
V6="${ROOT}/ops/monitoring/vimage6"
TARGET="${1:?usage: $0 user@host}"

if ! ssh "$TARGET" "command -v nvidia-smi >/dev/null 2>&1"; then
  echo "Skip ${TARGET}: nvidia-smi not found"
  exit 0
fi

echo "==> nvidia GPU textfile metrics on ${TARGET}"
ssh "$TARGET" "sudo mkdir -p /opt/nvidia-metrics/bin"
scp "${V6}/nvidia-gpu-collect.sh" "${TARGET}:/tmp/nvidia-gpu-collect.sh"
ssh "$TARGET" "sudo mv /tmp/nvidia-gpu-collect.sh /opt/nvidia-metrics/bin/nvidia-gpu-collect.sh
  sudo chmod 755 /opt/nvidia-metrics/bin/nvidia-gpu-collect.sh
  sudo tee /etc/systemd/system/nvidia-gpu-metrics.service >/dev/null <<'UNIT'
[Unit]
Description=NVIDIA GPU metrics for Prometheus node_exporter textfile collector
After=network.target

[Service]
Type=oneshot
ExecStart=/opt/nvidia-metrics/bin/nvidia-gpu-collect.sh
UNIT
  sudo tee /etc/systemd/system/nvidia-gpu-metrics.timer >/dev/null <<'UNIT'
[Unit]
Description=Refresh NVIDIA GPU Prometheus textfile metrics every 15s

[Timer]
OnBootSec=30
OnUnitActiveSec=15
AccuracySec=1s

[Install]
WantedBy=timers.target
UNIT
  sudo systemctl daemon-reload
  sudo systemctl enable --now nvidia-gpu-metrics.timer
  sudo /opt/nvidia-metrics/bin/nvidia-gpu-collect.sh"

echo "OK: nvidia GPU metrics on ${TARGET} → /opt/nvidia-metrics/nvidia.prom"
