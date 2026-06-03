#!/usr/bin/env bash
# Tahti unified backup — Postgres dump, MinIO DR mirror, restore verification, status.
#
# Usage:
#   ./scripts/backup.sh              # same as: all
#   ./scripts/backup.sh all          # postgres, then minio
#   ./scripts/backup.sh postgres
#   ./scripts/backup.sh minio
#   ./scripts/backup.sh restore-test
#   ./scripts/backup.sh status       # latest backup ages (for monitoring / cron checks)
#
# Cron (see scripts/install-crons.sh):
#   0 3 * * *  root .../backup.sh all
#   0 5 * * 0  root .../backup.sh restore-test
#
# Env: MINIO_ALIAS, BACKUP_BUCKET, PG_CONTAINER, SRC_ALIAS, DST_ALIAS, ALERT_EMAIL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CMD="${1:-all}"

log_ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }

backup_postgres() {
  local LOG_PREFIX="[$(log_ts)] [postgres-backup]"
  log() { echo "$LOG_PREFIX $*"; }
  die() { echo "$LOG_PREFIX ERROR: $*" >&2; exit 1; }

  local DATE BACKUP_KEY MINIO_ALIAS BACKUP_BUCKET CONTAINER_FILTER PG_CONTAINER SIZE COUNT
  DATE=$(date -u +%Y%m%d-%H%M%S)
  BACKUP_KEY="pg/${DATE}.sql.gz"
  MINIO_ALIAS="${MINIO_ALIAS:-tahti}"
  BACKUP_BUCKET="${BACKUP_BUCKET:-tahti}"
  CONTAINER_FILTER="${PG_CONTAINER:-tahti_postgres}"

  PG_CONTAINER=$(docker ps -qf "name=${CONTAINER_FILTER}" | head -1)
  [[ -n "$PG_CONTAINER" ]] || die "No running container matching '${CONTAINER_FILTER}'"

  log "Backing up from container $PG_CONTAINER → $BACKUP_KEY"

  docker exec "$PG_CONTAINER" \
    pg_dump -U tahti --no-password --no-acl --no-owner tahti \
    | gzip -9 \
    | mc pipe "${MINIO_ALIAS}/${BACKUP_BUCKET}/${BACKUP_KEY}"

  SIZE=$(mc stat "${MINIO_ALIAS}/${BACKUP_BUCKET}/${BACKUP_KEY}" --json \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('size',0))" 2>/dev/null || echo "?")

  log "Backup complete — ${BACKUP_KEY} (${SIZE} bytes)"

  COUNT=$(mc ls "${MINIO_ALIAS}/${BACKUP_BUCKET}/pg/" | wc -l)
  log "Total backup files in pg/: $COUNT"
  [[ $COUNT -gt 0 ]] || die "No backups found after upload — check mc configuration"
}

backup_minio() {
  local LOG_PREFIX="[$(log_ts)] [minio-backup]"
  log() { echo "$LOG_PREFIX $*"; }

  local SRC_ALIAS DST_ALIAS MIRROR_BUCKETS bucket RESULT TOTAL_SYNCED AUDIO_COUNT
  SRC_ALIAS="${SRC_ALIAS:-tahti}"
  DST_ALIAS="${DST_ALIAS:-tahti-dr}"
  MIRROR_BUCKETS=(audio covers backups)
  TOTAL_SYNCED=0

  count_objects() {
    local alias="$1"
    local bucket="$2"
    mc ls --recursive "${alias}/${bucket}/" 2>/dev/null | wc -l | tr -d ' '
  }

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

    SRC_COUNT=$(count_objects "$SRC_ALIAS" "$bucket")
    DST_COUNT=$(count_objects "$DST_ALIAS" "$bucket")
    log "$bucket object count: primary=$SRC_COUNT dr=$DST_COUNT"
    if [[ "$SRC_COUNT" -gt 0 ]]; then
      local max=$((SRC_COUNT + SRC_COUNT / 100 + 1))
      if [[ "$DST_COUNT" -lt "$SRC_COUNT" ]] || [[ "$DST_COUNT" -gt "$max" ]]; then
        log "WARNING: $bucket DR count outside 1% of primary (expected ~$SRC_COUNT)"
      else
        log "$bucket DR mirror count OK (within 1%)"
      fi
    fi
    ((TOTAL_SYNCED++)) || true
  done

  log "Mirror complete — $TOTAL_SYNCED buckets synced"
}

backup_restore_test() {
  local LOG_PREFIX="[$(log_ts)] [restore-test]"
  local TEMP_CONTAINER ALERT_EMAIL MINIO_ALIAS BACKUP_BUCKET EXPECTED_MIN_ROWS
  local LATEST_KEY TABLE_COUNT USER_COUNT RESULT_FILE

  log() { echo "$LOG_PREFIX $*"; }
  fail() {
    echo "$LOG_PREFIX FAIL: $*" >&2
    echo "$LOG_PREFIX Sending alert to ${ALERT_EMAIL:-ops@tahti.live}"
    echo "Restore test failed: $*" \
      | mail -s "[TAHTI] Restore test FAILED $(date)" "${ALERT_EMAIL:-ops@tahti.live}" 2>/dev/null || true
    exit 1
  }

  TEMP_CONTAINER="tahti-restore-test-$$"
  ALERT_EMAIL="${ALERT_EMAIL:-ops@tahti.live}"
  MINIO_ALIAS="${MINIO_ALIAS:-tahti}"
  BACKUP_BUCKET="${BACKUP_BUCKET:-tahti}"

  cleanup() { docker rm -f "$TEMP_CONTAINER" &>/dev/null || true; }
  trap cleanup EXIT

  log "Starting weekly restore verification"

  LATEST_KEY=$(mc ls "${MINIO_ALIAS}/${BACKUP_BUCKET}/pg/" \
    --json 2>/dev/null | python3 -c "
import sys, json
files = [json.loads(l) for l in sys.stdin if l.strip()]
if not files: exit(1)
latest = max(files, key=lambda f: f.get('lastModified',''))
print(latest.get('key','').lstrip('/'))
" 2>/dev/null) || fail "Could not list backups — mc alias may not be configured"

  [[ -n "$LATEST_KEY" ]] || fail "No backup files found in ${MINIO_ALIAS}/${BACKUP_BUCKET}/pg/"
  log "Latest backup: $LATEST_KEY"

  log "Starting temporary postgres container..."
  docker run -d \
    --name "$TEMP_CONTAINER" \
    -e POSTGRES_USER=tahti \
    -e POSTGRES_PASSWORD=test \
    -e POSTGRES_DB=tahti_test \
    postgres:16-alpine

  for _ in $(seq 1 30); do
    docker exec "$TEMP_CONTAINER" pg_isready -U tahti &>/dev/null && break
    sleep 2
  done
  docker exec "$TEMP_CONTAINER" pg_isready -U tahti || fail "Temp postgres did not start"
  log "Temp postgres ready"

  log "Restoring $LATEST_KEY..."
  mc cat "${MINIO_ALIAS}/${BACKUP_BUCKET}/${LATEST_KEY}" \
    | gunzip \
    | docker exec -i "$TEMP_CONTAINER" psql -U tahti -d tahti_test -q

  log "Restore complete"

  TABLE_COUNT=$(docker exec "$TEMP_CONTAINER" \
    psql -U tahti -d tahti_test -t -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('information_schema','pg_catalog');" \
    2>/dev/null | tr -d ' ')

  [[ "${TABLE_COUNT:-0}" -gt 0 ]] || fail "No tables found after restore — backup may be corrupt"
  log "Tables found: $TABLE_COUNT"

  USER_COUNT=$(docker exec "$TEMP_CONTAINER" \
    psql -U tahti -d tahti_test -t -c 'SELECT COUNT(*) FROM core."User" LIMIT 1;' \
    2>/dev/null | tr -d ' ' || echo "0")

  log "User rows: ${USER_COUNT:-0}"

  RESULT_FILE="/var/log/tahti-restore-test-last.txt"
  echo "date=$(date -u +%Y-%m-%d) backup=$LATEST_KEY tables=$TABLE_COUNT users=${USER_COUNT:-0}" \
    > "$RESULT_FILE" 2>/dev/null || true

  log "✓ Restore test PASSED — backup=$LATEST_KEY tables=$TABLE_COUNT users=${USER_COUNT:-0}"
}

backup_status() {
  local MINIO_ALIAS BACKUP_BUCKET WARN_HOURS PAGE_HOURS
  MINIO_ALIAS="${MINIO_ALIAS:-tahti}"
  BACKUP_BUCKET="${BACKUP_BUCKET:-tahti}"
  WARN_HOURS="${BACKUP_WARN_AGE_HOURS:-26}"
  PAGE_HOURS="${BACKUP_PAGE_AGE_HOURS:-48}"

  python3 - "$MINIO_ALIAS" "$BACKUP_BUCKET" "$WARN_HOURS" "$PAGE_HOURS" <<'PY'
import json, subprocess, sys
from datetime import datetime, timezone

alias, bucket, warn_h, page_h = sys.argv[1:5]
warn_h, page_h = float(warn_h), float(page_h)

def latest_age_hours(prefix: str) -> float | None:
    proc = subprocess.run(
        ["mc", "ls", f"{alias}/{bucket}/{prefix}/", "--json"],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        return None
    files = [json.loads(line) for line in proc.stdout.splitlines() if line.strip()]
    if not files:
        return None
    latest = max(files, key=lambda f: f.get("lastModified", ""))
    ts = latest.get("lastModified")
    if not ts:
        return None
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
    return age

pg_age = latest_age_hours("pg")
print(f"postgres_backup_age_hours={pg_age if pg_age is not None else 'missing'}")
if pg_age is None:
    print("status=CRITICAL reason=no_postgres_backup")
    sys.exit(2)
if pg_age > page_h:
    print(f"status=CRITICAL reason=backup_older_than_{page_h}h")
    sys.exit(2)
if pg_age > warn_h:
    print(f"status=WARN reason=backup_older_than_{warn_h}h")
    sys.exit(1)
print("status=OK")
sys.exit(0)
PY
}

case "$CMD" in
  postgres) backup_postgres ;;
  minio) backup_minio ;;
  restore-test) backup_restore_test ;;
  status) backup_status ;;
  all)
    echo "[$(log_ts)] [backup] Starting full backup (postgres + minio)"
    backup_postgres
    backup_minio
    echo "[$(log_ts)] [backup] Full backup complete"
    ;;
  -h|--help)
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "Unknown command: $CMD (try: all, postgres, minio, restore-test, status)" >&2
    exit 1
    ;;
esac
