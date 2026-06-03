#!/usr/bin/env bash
# Deploy latest images to 192.168.2.100:/srv/giggi-site.
# Run from the repo root on your dev machine.
#
# Usage:
#   TAG=$(git rev-parse --short HEAD) ./ops/giggi-site/deploy.sh
#   TAG=v0.1.0 ./ops/giggi-site/deploy.sh

set -euo pipefail

HOST=jani@192.168.2.100
SITE_DIR=/srv/giggi-site
TAG="${TAG:-$(git rev-parse --short HEAD)}"
REGISTRY="${REGISTRY:-registry.tahti.live}"

echo "── Deploying tag=$TAG to $HOST:$SITE_DIR ────────────────"

# 1. Sync compose file and prometheus config
scp infra/docker-compose.giggi-site.yml "$HOST:$SITE_DIR/docker-compose.yml"
scp infra/prometheus.yml "$HOST:$SITE_DIR/prometheus.yml"

# 2. Pull new images and restart changed services
ssh "$HOST" "
  set -euo pipefail
  cd $SITE_DIR
  echo '  Pulling images (TAG=$TAG)...'
  TAG=$TAG REGISTRY=$REGISTRY docker compose pull --ignore-pull-failures api web worker || true
  echo '  Restarting application services...'
  TAG=$TAG REGISTRY=$REGISTRY docker compose up -d --no-deps api web worker
  echo '  Running DB migrations...'
  docker compose exec -T api node dist/migrate.js 2>/dev/null || true
  echo '  Health check...'
  sleep 3
  curl -sf http://localhost:3001/health | grep -q '\"status\":\"ok\"' && echo 'API ok' || echo 'API not yet healthy'
"

echo ""
echo "Deploy complete. tag=$TAG"
