#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>
#
# Mirror MinIO audio/covers buckets to UpCloud Helsinki for offsite DR.
# Run daily via cron: 30 3 * * * /srv/tahti/ops/backup-minio.sh
#
# Env:
#   SOURCE_MC_ALIAS   — mc alias for primary MinIO (default: primary)
#   DEST_MC_ALIAS     — mc alias for UpCloud MinIO replica (default: replica)

set -euo pipefail

SOURCE="${SOURCE_MC_ALIAS:-primary}"
DEST="${DEST_MC_ALIAS:-replica}"
BUCKETS=("audio" "covers")

echo "[backup] Starting MinIO mirror at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

for bucket in "${BUCKETS[@]}"; do
  echo "[backup] Mirroring ${SOURCE}/${bucket} → ${DEST}/${bucket}"
  mc mirror \
    --preserve \
    --overwrite \
    --remove \
    "${SOURCE}/${bucket}" \
    "${DEST}/${bucket}"
  echo "[backup] Mirror complete: ${bucket}"
done

echo "[backup] MinIO mirror done"
