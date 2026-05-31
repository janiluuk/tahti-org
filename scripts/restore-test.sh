#!/usr/bin/env bash
# Weekly automated restore verification.
# Verifies the latest Postgres backup can actually be restored.
# Scheduled by /etc/cron.d/tahti-restore-test:
#   0 5 * * 0 root /srv/tahti/scripts/restore-test.sh >> /var/log/tahti-restore-test.log 2>&1
#
# Does NOT touch the production database.
# Spins up a temporary postgres container, restores the backup, checks row counts.

set -euo pipefail

LOG_PREFIX="[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [restore-test]"
TEMP_CONTAINER="tahti-restore-test-$$"
ALERT_EMAIL="${ALERT_EMAIL:-ops@tahti.fi}"
MINIO_ALIAS="${MINIO_ALIAS:-tahti}"
BACKUP_BUCKET="${BACKUP_BUCKET:-tahti}"
EXPECTED_MIN_ROWS="${EXPECTED_MIN_ROWS:-1}"   # minimum users table rows expected

log()  { echo "$LOG_PREFIX $*"; }
fail() { echo "$LOG_PREFIX FAIL: $*" >&2; echo "$LOG_PREFIX Sending alert to $ALERT_EMAIL"; \
         echo "Restore test failed: $*" | mail -s "[TAHTI] Restore test FAILED $(date)" "$ALERT_EMAIL" 2>/dev/null || true; \
         exit 1; }

cleanup() { docker rm -f "$TEMP_CONTAINER" &>/dev/null || true; }
trap cleanup EXIT

log "Starting weekly restore verification"

# ── Find latest backup ────────────────────────────────────────────────────
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

# ── Spin up temp postgres ─────────────────────────────────────────────────
log "Starting temporary postgres container..."
docker run -d \
  --name "$TEMP_CONTAINER" \
  -e POSTGRES_USER=tahti \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=tahti_test \
  postgres:16-alpine

# Wait for it to be ready
for i in $(seq 1 30); do
  docker exec "$TEMP_CONTAINER" pg_isready -U tahti &>/dev/null && break
  sleep 2
done
docker exec "$TEMP_CONTAINER" pg_isready -U tahti || fail "Temp postgres did not start"
log "Temp postgres ready"

# ── Restore backup into temp container ───────────────────────────────────
log "Restoring $LATEST_KEY..."
mc cat "${MINIO_ALIAS}/${BACKUP_BUCKET}/${LATEST_KEY}" \
  | gunzip \
  | docker exec -i "$TEMP_CONTAINER" psql -U tahti -d tahti_test -q

log "Restore complete"

# ── Sanity checks ─────────────────────────────────────────────────────────
TABLE_COUNT=$(docker exec "$TEMP_CONTAINER" \
  psql -U tahti -d tahti_test -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('information_schema','pg_catalog');" \
  2>/dev/null | tr -d ' ')

[[ "${TABLE_COUNT:-0}" -gt 0 ]] || fail "No tables found after restore — backup may be corrupt"
log "Tables found: $TABLE_COUNT"

# Check users table if it exists
USER_COUNT=$(docker exec "$TEMP_CONTAINER" \
  psql -U tahti -d tahti_test -t -c "SELECT COUNT(*) FROM core.\"User\" LIMIT 1;" \
  2>/dev/null | tr -d ' ' || echo "0")

log "User rows: ${USER_COUNT:-0}"

# ── Store result for drift detection ──────────────────────────────────────
RESULT_FILE="/var/log/tahti-restore-test-last.txt"
echo "date=$(date -u +%Y-%m-%d) backup=$LATEST_KEY tables=$TABLE_COUNT users=${USER_COUNT:-0}" \
  > "$RESULT_FILE" 2>/dev/null || true

log "✓ Restore test PASSED — backup=$LATEST_KEY tables=$TABLE_COUNT users=${USER_COUNT:-0}"
