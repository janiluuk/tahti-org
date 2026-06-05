#!/usr/bin/env bash
# Operator backup drill — timed restore-test + status check (Phase 9 / M29).
#
# Usage (on Swarm manager as root):
#   ./scripts/backup-drill.sh
#
# Pass criteria: restore-test exits 0 and backup status exits 0 (age < 26h).
# Log timing to stdout; suitable for quarterly ops exercise without the director.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="${BACKUP_DRILL_LOG:-/var/log/tahti-backup-drill.log}"
START=$(date -u +%Y-%m-%dT%H:%M:%SZ)

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

{
  log "=== Tahti backup drill start ==="
  log "operator=${SUDO_USER:-$(whoami)} host=$(hostname -s)"

  SEC0=$SECONDS
  log "Step 1/2: restore-test"
  "${ROOT}/scripts/backup.sh" restore-test
  RESTORE_SEC=$((SECONDS - SEC0))

  SEC1=$SECONDS
  log "Step 2/2: backup status"
  "${ROOT}/scripts/backup.sh" status
  STATUS_SEC=$((SECONDS - SEC1))

  TOTAL=$((SECONDS - SEC0))
  log "PASS restore_test_sec=${RESTORE_SEC} status_sec=${STATUS_SEC} total_sec=${TOTAL}"
  log "=== Tahti backup drill complete ==="
} 2>&1 | tee -a "$LOG"

exit "${PIPESTATUS[0]}"
