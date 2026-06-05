#!/usr/bin/env bash
# OPS-002: apply pending Prisma migrations before rolling out app services.
#
# Usage (from repo root on the Swarm manager or CI deploy host):
#   DATABASE_URL='postgresql://…' ./scripts/db-migrate-deploy.sh
#   PRE_MIGRATE_SNAPSHOT=1 DATABASE_URL=… ./scripts/db-migrate-deploy.sh
#   TAG=abc1234 REGISTRY=registry.tahti.live ./scripts/db-migrate-deploy.sh --image
#
# With --image, runs migrate inside the API image (production parity).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USE_IMAGE=false
REGISTRY="${REGISTRY:-registry.tahti.live}"
TAG="${TAG:-}"

if [[ "${PRE_MIGRATE_SNAPSHOT:-}" == "1" ]]; then
  echo "==> Pre-migration Postgres snapshot"
  "${ROOT}/scripts/pre-destructive-db-snapshot.sh"
fi

for arg in "$@"; do
  case "$arg" in
    --image) USE_IMAGE=true ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ "$USE_IMAGE" == true ]]; then
  [[ -n "$TAG" ]] || {
    echo "TAG is required with --image (e.g. TAG=\$(git rev-parse --short HEAD))" >&2
    exit 1
  }
  [[ -n "${DATABASE_URL:-}" ]] || {
    echo "DATABASE_URL is required" >&2
    exit 1
  }
  docker run --rm \
    -e DATABASE_URL \
    "${REGISTRY}/tahti/api:${TAG}" \
    sh -c 'pnpm --filter @tahti/db db:migrate'
else
  [[ -n "${DATABASE_URL:-}" ]] || {
    echo "DATABASE_URL is required (or use --image with TAG)" >&2
    exit 1
  }
  cd "$ROOT"
  pnpm --filter @tahti/db db:migrate
fi

echo "✓ Database migrations applied"
