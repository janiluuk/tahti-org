#!/usr/bin/env bash
# Start cAdvisor + docker-catalog if missing (called by monitoring-docker-agents.service).
set -euo pipefail

INSTANCE_NAME="${INSTANCE_NAME:?set INSTANCE_NAME}"
HOST_IP="${HOST_IP:?set HOST_IP}"
CADVISOR_PORT="${CADVISOR_PORT:-8081}"
EXPORTER_IMAGE="${EXPORTER_IMAGE:-python:3-alpine}"

start_cadvisor() {
  if docker ps --format '{{.Names}}' | grep -qx cadvisor; then
    return 0
  fi
  docker rm -f cadvisor 2>/dev/null || true
  docker run -d --name cadvisor --restart unless-stopped \
    --volume=/:/rootfs:ro \
    --volume=/var/run:/var/run:ro \
    --volume=/sys:/sys:ro \
    --volume=/var/lib/docker/:/var/lib/docker:ro \
    --device=/dev/kmsg \
    --publish "${CADVISOR_PORT}:8080" \
    gcr.io/cadvisor/cadvisor:v0.49.1
}

start_catalog() {
  if docker ps --format '{{.Names}}' | grep -qx docker-catalog-exporter; then
    return 0
  fi
  if [[ ! -x /opt/monitoring/bin/docker-catalog-exporter.py ]]; then
    echo "docker-catalog-exporter.py missing; run install-host-monitoring.sh first" >&2
    return 1
  fi
  docker rm -f docker-catalog-exporter 2>/dev/null || true
  docker run -d --name docker-catalog-exporter --restart unless-stopped \
    --network host \
    -e HOST_NAME="${INSTANCE_NAME}" \
    -e HOST_IP="${HOST_IP}" \
    -e URL_OVERRIDES=/etc/docker-catalog/url-overrides.json \
    -v /var/run/docker.sock:/var/run/docker.sock:ro \
    -v /opt/monitoring/docker-catalog:/etc/docker-catalog:ro \
    -v /opt/monitoring/bin/docker-catalog-exporter.py:/app/exporter.py:ro \
    "${EXPORTER_IMAGE}" python /app/exporter.py
}

start_cadvisor
start_catalog
