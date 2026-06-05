#!/usr/bin/env bash
# Deploy Tahti vital-services monitoring to vimage6 (192.168.2.105).
#
#   ./ops/monitoring/vimage6/deploy.sh
#
# Installs:
#   - Grafana dashboards → tahti-vital-services.json + tahti-overview.json
#   - Blackbox exporter (if missing) on :9115
#   - Prometheus scrape jobs (appended once) for Tahti /metrics + HTTP probes
#   - Prometheus alert rules for backup age (appended once to rule_files)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HOST="${MONITORING_HOST:-jani@192.168.2.105}"
PROM_DIR="/opt/monitoring/prometheus/config"
GRAFANA_DASH_DIR="/opt/monitoring/grafana/provisioning/dashboards"
BLACKBOX_DIR="/opt/monitoring/blackbox"
MARKER="tahti-vital-services (managed by tahti-org)"
RULES_MARKER="tahti-alert-rules (managed by tahti-org)"

echo "==> Deploy monitoring assets to ${HOST}"

ssh "$HOST" "mkdir -p '${BLACKBOX_DIR}' '${GRAFANA_DASH_DIR}'"

scp "${ROOT}/ops/monitoring/vimage6/blackbox.yml" \
  "${HOST}:${BLACKBOX_DIR}/blackbox.yml"

scp "${ROOT}/ops/monitoring/vimage6/tahti-vital-services.json" \
  "${HOST}:${GRAFANA_DASH_DIR}/tahti-vital-services.json"

scp "${ROOT}/ops/monitoring/vimage6/tahti-overview.json" \
  "${HOST}:${GRAFANA_DASH_DIR}/tahti-overview.json"

ssh "$HOST" "mkdir -p '${PROM_DIR}/rules'"
scp "${ROOT}/ops/monitoring/vimage6/prometheus-tahti-alerts.yml" \
  "${HOST}:${PROM_DIR}/rules/prometheus-tahti-alerts.yml"

if ! ssh "$HOST" "grep -q '${RULES_MARKER}' '${PROM_DIR}/prometheus.yml' 2>/dev/null"; then
  echo "==> Registering Prometheus alert rules (one-time)"
  echo "    Add under rule_files in ${PROM_DIR}/prometheus.yml if not already present:"
  echo "      - rules/prometheus-tahti-alerts.yml  # ${RULES_MARKER}"
  ssh "$HOST" "grep -q 'rules/prometheus-tahti-alerts.yml' '${PROM_DIR}/prometheus.yml' 2>/dev/null || \
    sed -i '/^rule_files:/a\\  - rules/prometheus-tahti-alerts.yml  # ${RULES_MARKER}' '${PROM_DIR}/prometheus.yml'"
else
  echo "==> Prometheus alert rules marker present — rules file refreshed"
fi

if ! ssh "$HOST" "grep -q '${MARKER}' '${PROM_DIR}/prometheus.yml' 2>/dev/null"; then
  echo "==> Appending Prometheus scrape jobs"
  ssh "$HOST" "cat >> '${PROM_DIR}/prometheus.yml'" < "${ROOT}/ops/monitoring/vimage6/prometheus-tahti.snippet.yml"
else
  echo "==> Prometheus snippet already present — skipping append"
fi

if ! ssh "$HOST" "docker ps --format '{{.Names}}' | grep -qx monitoring-blackbox"; then
  echo "==> Starting blackbox exporter"
  ssh "$HOST" "docker rm -f monitoring-blackbox 2>/dev/null || true"
  ssh "$HOST" "docker run -d --name monitoring-blackbox --restart unless-stopped \
    --network host \
    -v ${BLACKBOX_DIR}:/etc/blackbox \
    prom/blackbox-exporter:latest \
    --config.file=/etc/blackbox/blackbox.yml"
else
  echo "==> Reloading blackbox exporter config"
  ssh "$HOST" "docker restart monitoring-blackbox"
fi

echo "==> Reloading Prometheus + Grafana"
ssh "$HOST" "docker kill -s HUP monitoring-prometheus 2>/dev/null || docker restart monitoring-prometheus"
ssh "$HOST" "docker restart monitoring-grafana"

echo ""
echo "Done. Open Grafana on vimage6 → dashboards:"
echo "  - Tahti vital services (uid: tahti-vital-services)"
echo "  - Tahti — lab overview (uid: tahti-overview)"
