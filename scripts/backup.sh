#!/usr/bin/env bash
# Tahti unified backup — Postgres dump, MinIO DR mirror, restore verification, status.
#
# Usage:
#   ./scripts/backup.sh              # same as: all
#   ./scripts/backup.sh all          # postgres, then minio, then push to vimage6
#   ./scripts/backup.sh postgres
#   ./scripts/backup.sh minio
#   ./scripts/backup.sh vimage6      # rsync local pg dumps + minio mirror to vimage6
#   ./scripts/backup.sh restore-test
#   ./scripts/backup.sh status       # latest backup ages (for monitoring / cron checks)
#
# Cron (see scripts/install-crons.sh):
#   0 3 * * *  root .../backup.sh all
#   0 5 * * 0  root .../backup.sh restore-test
#
# Env: MINIO_ALIAS, BACKUP_BUCKET, PG_CONTAINER, SRC_ALIAS, DST_ALIAS, ALERT_EMAIL,
#      VIMAGE6_BACKUP_HOST, VIMAGE6_BACKUP_KEY, VIMAGE6_BACKUP_DIR

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CMD="${1:-all}"

log_ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }

backup_postgres() {
  local LOG_PREFIX="[$(log_ts)] [postgres-backup]"
  log() { echo "$LOG_PREFIX $*"; }
  die() { echo "$LOG_PREFIX ERROR: $*" >&2; exit 1; }

  local DATE BACKUP_KEY MINIO_ALIAS BACKUP_BUCKET CONTAINER_FILTER PG_CONTAINER
  local LOCAL_BACKUP_DIR LOCAL_RETENTION_DAYS LOCAL_FILE COUNT
  DATE=$(date -u +%Y%m%d-%H%M%S)
  BACKUP_KEY="pg/${DATE}.sql.gz"
  MINIO_ALIAS="${MINIO_ALIAS:-tahti}"
  BACKUP_BUCKET="${BACKUP_BUCKET:-backups}"
  # NB: compose project renders container names as "tahti-stack-postgres-1"
  # (hyphens), not "tahti_postgres" — keep this in sync with the service name
  # in infra/docker-compose.stack.yml if that ever changes.
  CONTAINER_FILTER="${PG_CONTAINER:-tahti-stack-postgres}"
  LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-/share/disk2/tahti-backups/pg}"
  LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-30}"

  PG_CONTAINER=$(docker ps -qf "name=${CONTAINER_FILTER}" | head -1)
  [[ -n "$PG_CONTAINER" ]] || die "No running container matching '${CONTAINER_FILTER}'"

  # Local disk copy is the primary safety net — it lives on a physically
  # separate mount from any Docker-managed volume, so it survives the class
  # of incident that wiped prod on 2026-08-13 (a Docker volume recreated
  # fresh; MinIO's own volume was recreated in that same event, so a
  # MinIO-only backup would not have helped).
  mkdir -p "$LOCAL_BACKUP_DIR"
  LOCAL_FILE="${LOCAL_BACKUP_DIR}/${DATE}.sql.gz"

  log "Backing up from container $PG_CONTAINER → $LOCAL_FILE"
  docker exec "$PG_CONTAINER" \
    pg_dump -U tahti --no-password --no-acl --no-owner tahti \
    | gzip -9 > "$LOCAL_FILE"
  [[ -s "$LOCAL_FILE" ]] || die "Local backup file is empty — pg_dump likely failed"
  log "Local backup complete — ${LOCAL_FILE} ($(du -h "$LOCAL_FILE" | cut -f1))"

  find "$LOCAL_BACKUP_DIR" -maxdepth 1 -name '*.sql.gz' -mtime "+${LOCAL_RETENTION_DAYS}" -delete
  COUNT=$(find "$LOCAL_BACKUP_DIR" -maxdepth 1 -name '*.sql.gz' | wc -l | tr -d ' ')
  log "Local backups retained (<=${LOCAL_RETENTION_DAYS}d): $COUNT"
  [[ "$COUNT" -gt 0 ]] || die "No local backups found after write — check ${LOCAL_BACKUP_DIR}"

  # Secondary copy in the primary MinIO — convenient for restore-test/status,
  # but NOT a substitute for the local copy above (same host, same class of
  # volume-wipe risk). Skips cleanly if mc isn't set up yet.
  if command -v mc >/dev/null 2>&1 && mc alias list 2>/dev/null | grep -qx "$MINIO_ALIAS"; then
    if mc pipe "${MINIO_ALIAS}/${BACKUP_BUCKET}/${BACKUP_KEY}" < "$LOCAL_FILE"; then
      log "Also uploaded to MinIO — ${BACKUP_KEY}"
    else
      log "WARNING: MinIO upload failed — local backup at ${LOCAL_FILE} is still authoritative"
    fi
  else
    log "mc alias '${MINIO_ALIAS}' not configured — skipping MinIO copy (local backup only)"
  fi
}

backup_minio() {
  local LOG_PREFIX="[$(log_ts)] [minio-backup]"
  log() { echo "$LOG_PREFIX $*"; }

  local SRC_ALIAS DST_ALIAS LOCAL_MIRROR_DIR MIRROR_BUCKETS bucket RESULT TOTAL_SYNCED
  SRC_ALIAS="${SRC_ALIAS:-tahti}"
  DST_ALIAS="${DST_ALIAS:-tahti-dr}"
  LOCAL_MIRROR_DIR="${LOCAL_MIRROR_DIR:-/share/disk2/tahti-backups/minio-mirror}"
  MIRROR_BUCKETS=(audio covers recordings)
  TOTAL_SYNCED=0

  count_objects() {
    local alias="$1"
    local bucket="$2"
    mc ls --recursive "${alias}/${bucket}/" 2>/dev/null | wc -l | tr -d ' '
  }

  # Local disk mirror — same rationale as the Postgres local copy: MinIO's
  # own Docker volume was recreated in the same 2026-08-13 incident that
  # wiped Postgres, so a same-host MinIO→MinIO copy alone proved not to be
  # independent redundancy. This gives the actual uploaded audio/cover files
  # a copy outside any Docker-managed volume.
  mkdir -p "$LOCAL_MIRROR_DIR"
  for bucket in "${MIRROR_BUCKETS[@]}"; do
    log "Mirroring $bucket → local disk ($LOCAL_MIRROR_DIR)..."
    if RESULT=$(mc mirror --overwrite --remove --summary "${SRC_ALIAS}/${bucket}/" "${LOCAL_MIRROR_DIR}/${bucket}/" 2>&1); then
      log "$bucket (local): $RESULT"
    else
      log "WARNING: local mirror of $bucket failed: $RESULT"
    fi
    ((TOTAL_SYNCED++)) || true
  done
  log "Local mirror complete — $TOTAL_SYNCED buckets synced to disk"

  # Offsite DR mirror — only runs once a real DR destination alias exists.
  # As of 2026-08-16 no offsite DR (e.g. UpCloud) has been provisioned, so
  # this cleanly skips instead of failing the whole cron run.
  if ! mc alias list 2>/dev/null | grep -qx "$DST_ALIAS"; then
    log "WARNING: DR alias '${DST_ALIAS}' not configured — offsite mirror skipped (no DR destination provisioned yet; local disk mirror above is the only redundancy right now)"
    return 0
  fi

  for bucket in "${MIRROR_BUCKETS[@]}" backups; do
    log "Mirroring $bucket → DR..."
    RESULT=$(mc mirror \
      --overwrite \
      --remove \
      --preserve \
      --summary \
      "${SRC_ALIAS}/${bucket}/" \
      "${DST_ALIAS}/${bucket}/" 2>&1) || true
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
  done

  log "DR mirror complete"
}

backup_push_vimage6() {
  local LOG_PREFIX="[$(log_ts)] [vimage6-push]"
  log() { echo "$LOG_PREFIX $*"; }

  local VIMAGE6_HOST VIMAGE6_KEY VIMAGE6_REMOTE_DIR LOCAL_BACKUP_DIR LOCAL_MIRROR_DIR RSYNC_SSH RESULT
  VIMAGE6_HOST="${VIMAGE6_BACKUP_HOST:-jani@192.168.2.105}"
  VIMAGE6_KEY="${VIMAGE6_BACKUP_KEY:-/root/.ssh/vimage6_backup_ed25519}"
  VIMAGE6_REMOTE_DIR="${VIMAGE6_BACKUP_DIR:-/home/jani/tahti-backups/tahti}"
  LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-/share/disk2/tahti-backups/pg}"
  LOCAL_MIRROR_DIR="${LOCAL_MIRROR_DIR:-/share/disk2/tahti-backups/minio-mirror}"

  if [[ ! -f "$VIMAGE6_KEY" ]]; then
    log "WARNING: key ${VIMAGE6_KEY} not found — skipping off-host push to vimage6"
    return 0
  fi

  # Off-host copy on a second physical machine (vimage6, the monitoring host).
  # The /share/disk2 copy above is still on the same host as the primary
  # Postgres/MinIO volumes, so it alone wouldn't survive a whole-host loss.
  # The receiving key on vimage6 is restricted (rrsync -wo, no shell, no
  # port/agent forwarding) to /home/jani/tahti-backups/tahti.
  RSYNC_SSH="ssh -i ${VIMAGE6_KEY} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

  if [[ -d "$LOCAL_BACKUP_DIR" ]]; then
    if RESULT=$(rsync -az -e "$RSYNC_SSH" "${LOCAL_BACKUP_DIR}/" "${VIMAGE6_HOST}:${VIMAGE6_REMOTE_DIR}/pg/" 2>&1); then
      log "Postgres dumps synced to vimage6:${VIMAGE6_REMOTE_DIR}/pg/"
    else
      log "WARNING: vimage6 postgres sync failed: $RESULT"
    fi
  fi

  if [[ -d "$LOCAL_MIRROR_DIR" ]]; then
    if RESULT=$(rsync -az -e "$RSYNC_SSH" "${LOCAL_MIRROR_DIR}/" "${VIMAGE6_HOST}:${VIMAGE6_REMOTE_DIR}/minio-mirror/" 2>&1); then
      log "MinIO mirror synced to vimage6:${VIMAGE6_REMOTE_DIR}/minio-mirror/"
    else
      log "WARNING: vimage6 minio-mirror sync failed: $RESULT"
    fi
  fi
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
  BACKUP_BUCKET="${BACKUP_BUCKET:-backups}"

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
  local MINIO_ALIAS BACKUP_BUCKET WARN_HOURS PAGE_HOURS DST_ALIAS LOCAL_BACKUP_DIR
  local VIMAGE6_HOST VIMAGE6_KEY VIMAGE6_REMOTE_DIR
  MINIO_ALIAS="${MINIO_ALIAS:-tahti}"
  BACKUP_BUCKET="${BACKUP_BUCKET:-backups}"
  WARN_HOURS="${BACKUP_WARN_AGE_HOURS:-26}"
  PAGE_HOURS="${BACKUP_PAGE_AGE_HOURS:-48}"
  DST_ALIAS="${DST_ALIAS:-tahti-dr}"
  LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-/share/disk2/tahti-backups/pg}"
  VIMAGE6_HOST="${VIMAGE6_BACKUP_HOST:-jani@192.168.2.105}"
  VIMAGE6_KEY="${VIMAGE6_BACKUP_KEY:-/root/.ssh/vimage6_backup_ed25519}"
  VIMAGE6_REMOTE_DIR="${VIMAGE6_BACKUP_DIR:-/home/jani/tahti-backups/tahti}"

  # Best-effort — informational only, does not affect exit code (local disk
  # copy stays the authoritative signal for paging, see below).
  if [[ -f "$VIMAGE6_KEY" ]]; then
    VIMAGE6_LATEST=$(ssh -i "$VIMAGE6_KEY" -o BatchMode=yes -o ConnectTimeout=5 "$VIMAGE6_HOST" \
      "find '${VIMAGE6_REMOTE_DIR}/pg' -maxdepth 1 -name '*.sql.gz' -printf '%T@\n' 2>/dev/null | sort -n | tail -1" 2>/dev/null || true)
    if [[ -n "$VIMAGE6_LATEST" ]]; then
      VIMAGE6_AGE_HOURS=$(awk -v t="$VIMAGE6_LATEST" 'BEGIN { print (systime() - t) / 3600 }')
      echo "vimage6_postgres_backup_age_hours=${VIMAGE6_AGE_HOURS}"
    else
      echo "vimage6_postgres_backup_age_hours=missing"
    fi
  else
    echo "vimage6_postgres_backup_age_hours=missing reason=no_key"
  fi

  MINIO_ALIAS="$MINIO_ALIAS" BACKUP_BUCKET="$BACKUP_BUCKET" \
    WARN_HOURS="$WARN_HOURS" PAGE_HOURS="$PAGE_HOURS" DST_ALIAS="$DST_ALIAS" \
    LOCAL_BACKUP_DIR="$LOCAL_BACKUP_DIR" \
    python3 - <<'PY'
import json, os, subprocess, sys, glob
from datetime import datetime, timezone

alias = os.environ["MINIO_ALIAS"]
dst_alias = os.environ["DST_ALIAS"]
bucket = os.environ["BACKUP_BUCKET"]
local_dir = os.environ["LOCAL_BACKUP_DIR"]
warn_h, page_h = float(os.environ["WARN_HOURS"]), float(os.environ["PAGE_HOURS"])

def latest_age_hours(mc_alias: str, prefix: str) -> float | None:
    proc = subprocess.run(
        ["mc", "ls", f"{mc_alias}/{bucket}/{prefix}/", "--json"],
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
    return (datetime.now(timezone.utc) - dt).total_seconds() / 3600

def latest_local_age_hours(directory: str) -> float | None:
    files = glob.glob(os.path.join(directory, "*.sql.gz"))
    if not files:
        return None
    newest = max(files, key=os.path.getmtime)
    mtime = datetime.fromtimestamp(os.path.getmtime(newest), tz=timezone.utc)
    return (datetime.now(timezone.utc) - mtime).total_seconds() / 3600

local_age = latest_local_age_hours(local_dir)
pg_age = latest_age_hours(alias, "pg")
dr_pg_age = latest_age_hours(dst_alias, "pg")
print(f"local_postgres_backup_age_hours={local_age if local_age is not None else 'missing'}")
print(f"postgres_backup_age_hours={pg_age if pg_age is not None else 'missing'}")
print(f"minio_dr_postgres_backup_age_hours={dr_pg_age if dr_pg_age is not None else 'missing'}")
if pg_age is not None and dr_pg_age is not None and abs(pg_age - dr_pg_age) > 2:
    print("dr_mirror=WARN reason=dr_pg_backup_diverged_from_primary")

# The local copy is the authoritative safety net (see backup_postgres) — it's
# what status/paging is actually keyed on.
if local_age is None:
    print("status=CRITICAL reason=no_local_postgres_backup")
    sys.exit(2)
if local_age > page_h:
    print(f"status=CRITICAL reason=local_backup_older_than_{page_h}h")
    sys.exit(2)
if local_age > warn_h:
    print(f"status=WARN reason=local_backup_older_than_{warn_h}h")
    sys.exit(1)
print("status=OK")
sys.exit(0)
PY
}

case "$CMD" in
  postgres) backup_postgres ;;
  minio) backup_minio ;;
  vimage6) backup_push_vimage6 ;;
  restore-test) backup_restore_test ;;
  status) backup_status ;;
  all)
    echo "[$(log_ts)] [backup] Starting full backup (postgres + minio)"
    backup_postgres
    backup_minio
    backup_push_vimage6
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
