#!/usr/bin/env bash
# OPS / Phase 2b: snapshot Postgres before destructive ops (migrations, volume resize).
#
# Writes a gzipped pg_dump to MinIO backups/pg/pre-op-{timestamp}.sql.gz when mc is
# configured, otherwise to ./backups/pre-op-{timestamp}.sql.gz under the repo.
#
# Usage:
#   ./scripts/pre-destructive-db-snapshot.sh
#   PG_CONTAINER=tahti-stack-postgres-1 ./scripts/pre-destructive-db-snapshot.sh
#
# Run manually before `prisma migrate`, `db push`, or Postgres volume changes.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATE=$(date -u +%Y%m%d-%H%M%S)
KEY="pg/pre-op-${DATE}.sql.gz"
MINIO_ALIAS="${MINIO_ALIAS:-tahti}"
BACKUP_BUCKET="${BACKUP_BUCKET:-backups}"
CONTAINER_FILTER="${PG_CONTAINER:-postgres}"

resolve_container() {
  if [[ -n "${PG_CONTAINER:-}" ]] && docker ps -q --filter "name=^/${PG_CONTAINER}$" | grep -q .; then
    echo "$PG_CONTAINER"
    return
  fi
  local id
  id=$(docker ps -qf "name=${CONTAINER_FILTER}" | head -1)
  [[ -n "$id" ]] || {
    echo "No running Postgres container (tried PG_CONTAINER / name~${CONTAINER_FILTER})" >&2
    exit 1
  }
  echo "$id"
}

PG_CID=$(resolve_container)
echo "==> Pre-op snapshot from container ${PG_CID}"

if command -v mc >/dev/null 2>&1 && mc alias list 2>/dev/null | grep -q "^${MINIO_ALIAS} "; then
  docker exec "$PG_CID" pg_dump -U tahti --no-password --no-acl --no-owner tahti \
    | gzip -9 \
    | mc pipe "${MINIO_ALIAS}/${BACKUP_BUCKET}/${KEY}"
  echo "✓ Snapshot → ${MINIO_ALIAS}/${BACKUP_BUCKET}/${KEY}"
else
  OUT_DIR="${ROOT}/backups"
  mkdir -p "$OUT_DIR"
  OUT_FILE="${OUT_DIR}/pre-op-${DATE}.sql.gz"
  docker exec "$PG_CID" pg_dump -U tahti --no-password --no-acl --no-owner tahti | gzip -9 >"$OUT_FILE"
  echo "✓ Snapshot → ${OUT_FILE} (MinIO mc alias '${MINIO_ALIAS}' not configured)"
fi
