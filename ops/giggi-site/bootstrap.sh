#!/usr/bin/env bash
# Run ONCE on 192.168.2.100 to prepare /srv/giggi-site for first deployment.
#
#   scp ops/giggi-site/bootstrap.sh jani@192.168.2.100:/tmp/
#   ssh jani@192.168.2.100 bash /tmp/bootstrap.sh

set -euo pipefail

SITE_DIR=/srv/giggi-site

echo "── Creating directory structure ──────────────────────────"
sudo mkdir -p "$SITE_DIR"/{data/{postgres,redis,minio,prometheus,grafana},conf}
sudo chown -R "$(whoami):$(whoami)" "$SITE_DIR"
chmod 750 "$SITE_DIR"

echo "── Checking Docker ───────────────────────────────────────"
docker --version || { echo "Docker not installed — install via https://docs.docker.com/engine/install/"; exit 1; }
docker compose version || { echo "docker compose plugin not found"; exit 1; }

echo ""
echo "Bootstrap complete. Next steps:"
echo ""
echo "  1. Copy the compose and env files:"
echo "     scp infra/docker-compose.giggi-site.yml jani@192.168.2.100:$SITE_DIR/docker-compose.yml"
echo "     scp infra/prometheus.yml jani@192.168.2.100:$SITE_DIR/prometheus.yml"
echo "     scp infra/.env.giggi-site.example jani@192.168.2.100:$SITE_DIR/.env"
echo ""
echo "  2. Fill in secrets:"
echo "     ssh jani@192.168.2.100 'nano $SITE_DIR/.env && chmod 600 $SITE_DIR/.env'"
echo ""
echo "  3. Start stateful services first:"
echo "     ssh jani@192.168.2.100 'cd $SITE_DIR && docker compose up -d postgres redis minio'"
echo ""
echo "  4. Push DB schema (from your dev machine):"
echo "     DATABASE_URL=postgres://tahti:<pw>@192.168.2.100:5432/tahti \\"
echo "       pnpm --filter @tahti/db db:migrate:test"
echo ""
echo "  5. When images are built, bring up full stack:"
echo "     ssh jani@192.168.2.100 'cd $SITE_DIR && docker compose up -d'"
