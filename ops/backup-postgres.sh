#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2024 Tahti ry <https://tahti.fi>
#
# Postgres backup via pg_dump → compressed file → upload to MinIO backups bucket.
# Run daily via cron: 0 3 * * * /srv/tahti/ops/backup-postgres.sh
#
# Env:
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE
#   MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET

set -euo pipefail

DB="${PGDATABASE:-tahti}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="/tmp/pg-backup-${DB}-${TS}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

echo "[backup] Starting Postgres dump for ${DB} at ${TS}"

pg_dump \
  --no-owner \
  --no-acl \
  --format=plain \
  "${DB}" \
  | gzip -9 > "${DUMP_FILE}"

SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)
echo "[backup] Dump complete: ${DUMP_FILE} (${SIZE})"

# Upload to MinIO via mc (MinIO Client)
MC_ALIAS="${MINIO_ALIAS:-backup}"
DEST="${MC_ALIAS}/backups/postgres/${DB}/${TS}.sql.gz"

mc cp "${DUMP_FILE}" "${DEST}"
echo "[backup] Uploaded to ${DEST}"

rm -f "${DUMP_FILE}"

# Prune old backups
echo "[backup] Pruning backups older than ${RETENTION_DAYS} days"
mc find "${MC_ALIAS}/backups/postgres/${DB}/" \
  --older-than "${RETENTION_DAYS}d" \
  --name "*.sql.gz" \
  | xargs -r mc rm

echo "[backup] Postgres backup complete"
