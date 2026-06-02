#!/usr/bin/env bash
# Restore Postgres from a backup in MinIO.
# Use for disaster recovery when the primary database is lost.
#
# Usage: ./scripts/restore-postgres.sh [backup-key]
#   backup-key: e.g. pg/20260519-030000.sql.gz (omit to list latest 10)
#
# WARNING: This restores INTO the running postgres container.
# All existing data will be dropped. Run only during a declared incident.

set -euo pipefail

MINIO_ALIAS="${MINIO_ALIAS:-tahti}"
BACKUP_BUCKET="${BACKUP_BUCKET:-tahti}"
CONTAINER_FILTER="${PG_CONTAINER:-tahti_postgres}"

red()    { printf "\033[31m%s\033[0m\n" "$1"; }
green()  { printf "\033[32m✓\033[0m %s\n" "$1"; }
yellow() { printf "\033[33m⚠\033[0m %s\n" "$1"; }

PG_CONTAINER=$(docker ps -qf "name=${CONTAINER_FILTER}" | head -1)
[[ -n "$PG_CONTAINER" ]] || { red "No postgres container found matching '${CONTAINER_FILTER}'"; exit 1; }

# ── If no key given, show latest 10 and ask ───────────────────────────────
if [[ -z "${1:-}" ]]; then
  echo "Latest 10 backups:"
  mc ls "${MINIO_ALIAS}/${BACKUP_BUCKET}/pg/" | tail -10
  echo ""
  printf "Enter backup key (e.g. pg/20260519-030000.sql.gz): "
  read -r BACKUP_KEY
else
  BACKUP_KEY="$1"
fi

[[ -n "$BACKUP_KEY" ]] || { red "No backup key given"; exit 1; }

# ── Confirmation ──────────────────────────────────────────────────────────
echo ""
yellow "WARNING: This will DROP and recreate the 'tahti' database."
yellow "All current data will be permanently deleted."
yellow "Backup: ${MINIO_ALIAS}/${BACKUP_BUCKET}/${BACKUP_KEY}"
echo ""
printf "Type 'yes I understand' to continue: "
read -r CONFIRM
[[ "$CONFIRM" == "yes I understand" ]] || { red "Aborted."; exit 1; }

# ── Drop and recreate database ────────────────────────────────────────────
echo ""
echo "→ Dropping existing database..."
docker exec "$PG_CONTAINER" \
  psql -U tahti -d postgres -c "DROP DATABASE IF EXISTS tahti;" -c "CREATE DATABASE tahti OWNER tahti;"
green "Database recreated"

# ── Stream backup from MinIO into postgres ────────────────────────────────
echo "→ Restoring from ${BACKUP_KEY}..."
mc cat "${MINIO_ALIAS}/${BACKUP_BUCKET}/${BACKUP_KEY}" \
  | gunzip \
  | docker exec -i "$PG_CONTAINER" psql -U tahti -d tahti
green "Restore complete"

# ── Quick sanity check ────────────────────────────────────────────────────
echo "→ Checking row counts..."
docker exec "$PG_CONTAINER" psql -U tahti -d tahti -c "\dt" 2>/dev/null | head -20

echo ""
echo "Restore complete from: $BACKUP_KEY"
echo "Restart app services to reconnect: docker service update --force tahti_api"
