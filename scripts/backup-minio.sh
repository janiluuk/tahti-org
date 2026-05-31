#!/usr/bin/env bash
# Daily MinIO mirror to UpCloud Helsinki bucket (DR copy).
# RPO: 24 hours for archive audio. Live HLS segments are ephemeral — not mirrored.
# Scheduled by /etc/cron.d/tahti-backup:
#   0 4 * * * root /srv/tahti/scripts/backup-minio.sh >> /var/log/tahti-backup.log 2>&1

set -euo pipefail

LOG_PREFIX="[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [minio-backup]"
log() { echo "$LOG_PREFIX $*"; }
die() { echo "$LOG_PREFIX ERROR: $*" >&2; exit 1; }

# ── Config ────────────────────────────────────────────────────────────────
SRC_ALIAS="${SRC_ALIAS:-tahti}"              # production MinIO
DST_ALIAS="${DST_ALIAS:-tahti-dr}"           # UpCloud Helsinki bucket (mc alias)

# Buckets to mirror — NOT hls-live (ephemeral) or recordings (transient)
MIRROR_BUCKETS=(audio covers backups)

# ── Mirror each bucket ────────────────────────────────────────────────────
TOTAL_SYNCED=0

for bucket in "${MIRROR_BUCKETS[@]}"; do
  log "Mirroring $bucket → DR..."
  RESULT=$(mc mirror \
    --overwrite \
    --remove \
    --preserve \
    --summary \
    "${SRC_ALIAS}/${bucket}/" \
    "${DST_ALIAS}/${bucket}/" 2>&1)
  log "$bucket: $RESULT"
  ((TOTAL_SYNCED++))
done

log "Mirror complete — $TOTAL_SYNCED buckets synced"

# ── Sanity check: DR bucket is not empty ──────────────────────────────────
AUDIO_COUNT=$(mc ls "${DST_ALIAS}/audio/" 2>/dev/null | wc -l || echo "0")
[[ $AUDIO_COUNT -gt 0 ]] && log "DR audio/ has $AUDIO_COUNT objects ✓" || \
  log "WARNING: DR audio/ is empty — first run or all files were deleted upstream"
