#!/usr/bin/env bash
# Deploy Tahti monitoring to vimage6 (192.168.2.105).
#
#   ./ops/monitoring/vimage6/deploy.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HOST="${MONITORING_HOST:-jani@192.168.2.105}"
PROM_DIR="/opt/monitoring/prometheus/config"
GRAFANA_DASH_DIR="/opt/monitoring/grafana/provisioning/dashboards"
BLACKBOX_DIR="/opt/monitoring/blackbox"
V6="${ROOT}/ops/monitoring/vimage6"

echo "==> Generate infrastructure dashboard JSON"
python3 "${V6}/generate-tahti-infrastructure-dashboard.py"

echo "==> Deploy monitoring assets to ${HOST}"
ssh "$HOST" "mkdir -p '${BLACKBOX_DIR}' '${GRAFANA_DASH_DIR}' '${PROM_DIR}/rules'"

scp "${V6}/blackbox.yml" "${HOST}:${BLACKBOX_DIR}/blackbox.yml"
scp "${V6}/tahti-vital-services.json" "${HOST}:${GRAFANA_DASH_DIR}/tahti-vital-services.json"
scp "${V6}/tahti-overview.json" "${HOST}:${GRAFANA_DASH_DIR}/tahti-overview.json"
scp "${V6}/tahti-infrastructure.json" "${HOST}:${GRAFANA_DASH_DIR}/tahti-infrastructure.json"
scp "${V6}/prometheus-tahti-alerts.yml" "${HOST}:${PROM_DIR}/rules/prometheus-tahti-alerts.yml"
scp "${V6}/prometheus-tahti.snippet.yml" "${HOST}:/tmp/prometheus-tahti.snippet.yml"
scp "${V6}/patch-prometheus-tahti.py" "${HOST}:/tmp/patch-prometheus-tahti.py"

echo "==> Patch Prometheus scrape jobs + alert rules"
ssh "$HOST" "python3 /tmp/patch-prometheus-tahti.py '${PROM_DIR}/prometheus.yml' /tmp/prometheus-tahti.snippet.yml"

if ! ssh "$HOST" "docker ps --format '{{.Names}}' | grep -qx monitoring-blackbox"; then
  echo "==> Starting blackbox exporter"
  ssh "$HOST" "docker rm -f monitoring-blackbox 2>/dev/null || true"
  ssh "$HOST" "docker run -d --name monitoring-blackbox --restart unless-stopped \
    --network host \
    -v ${BLACKBOX_DIR}:/etc/blackbox \
    prom/blackbox-exporter:latest \
    --config.file=/etc/blackbox/blackbox.yml"
else
  echo "==> Reloading blackbox exporter"
  ssh "$HOST" "docker restart monitoring-blackbox"
fi

echo "==> Validate Prometheus config"
ssh "$HOST" "docker exec monitoring-prometheus promtool check config /etc/prometheus/prometheus.yml"

echo "==> Reload Prometheus + Grafana"
ssh "$HOST" "docker kill -s HUP monitoring-prometheus 2>/dev/null || docker restart monitoring-prometheus"
ssh "$HOST" "docker restart monitoring-grafana"

echo ""
echo "Done. Grafana on vimage6 → dashboards:"
echo "  - Tahti — infrastructure & services (uid: tahti-infrastructure)"
echo "  - Tahti vital services (uid: tahti-vital-services)"
echo "  - Tahti — lab overview (uid: tahti-overview)"
echo ""
echo "Prometheus targets: tahti_api_metrics, tahti_blackbox, tahti_blackbox_public, tahti_blackbox_tcp"
