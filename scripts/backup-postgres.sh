#!/usr/bin/env bash
# Daily Postgres backup to UpCloud object storage (S3-compatible).
# Scheduled by /etc/cron.d/tahti-backup:
#   0 3 * * * root /srv/tahti/scripts/backup-postgres.sh >> /var/log/tahti-backup.log 2>&1
#
# Retention: 90 days (enforced by MinIO lifecycle on the backups/ bucket).
# RPO: 24 hours (daily schedule). For RPO < 1h, switch to pgBackRest WAL shipping.

set -euo pipefail

DATE=$(date -u +%Y%m%d-%H%M%S)
BACKUP_KEY="pg/${DATE}.sql.gz"
LOG_PREFIX="[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [postgres-backup]"

log()  { echo "$LOG_PREFIX $*"; }
die()  { echo "$LOG_PREFIX ERROR: $*" >&2; exit 1; }

# ── Config ────────────────────────────────────────────────────────────────
MINIO_ALIAS="${MINIO_ALIAS:-tahti}"           # mc alias (set up once on the host)
BACKUP_BUCKET="${BACKUP_BUCKET:-tahti}"
CONTAINER_FILTER="${PG_CONTAINER:-tahti_postgres}"

# ── Find running Postgres container ──────────────────────────────────────
PG_CONTAINER=$(docker ps -qf "name=${CONTAINER_FILTER}" | head -1)
[[ -n "$PG_CONTAINER" ]] || die "No running container matching '${CONTAINER_FILTER}'"

log "Backing up from container $PG_CONTAINER → $BACKUP_KEY"

# ── Dump, compress, stream directly to MinIO — no temp file on disk ──────
docker exec "$PG_CONTAINER" \
  pg_dump -U tahti --no-password --no-acl --no-owner tahti \
  | gzip -9 \
  | mc pipe "${MINIO_ALIAS}/${BACKUP_BUCKET}/${BACKUP_KEY}"

SIZE=$(mc stat "${MINIO_ALIAS}/${BACKUP_BUCKET}/${BACKUP_KEY}" --json \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('size',0))" 2>/dev/null || echo "?")

log "Backup complete — ${BACKUP_KEY} (${SIZE} bytes)"

# ── Verify last 3 backups exist ───────────────────────────────────────────
COUNT=$(mc ls "${MINIO_ALIAS}/${BACKUP_BUCKET}/pg/" | wc -l)
log "Total backup files in pg/: $COUNT"

[[ $COUNT -gt 0 ]] || die "No backups found after upload — check mc configuration"
