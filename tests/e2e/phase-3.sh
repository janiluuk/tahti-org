#!/usr/bin/env bash
# Phase 3 exit criteria — stateful services healthy, secrets set, backups working.
# Run on the production Swarm manager after Phase 3 deploy.
#
# Usage: ./tests/e2e/phase-3.sh

set -euo pipefail

PASS=0
FAIL=0
STACK="${STACK:-tahti}"

green() { printf "\033[32m✓\033[0m %s\n" "$1"; }
red()   { printf "\033[31m✗\033[0m %s\n" "$1"; }

check() {
  local label="$1"; local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    green "$label"; ((PASS++))
  else
    red "$label — FAILED"; ((FAIL++))
  fi
}

container_exec() {
  local filter="$1"; shift
  local cid; cid=$(docker ps -qf "name=${STACK}_${filter}" | head -1)
  [[ -n "$cid" ]] && docker exec "$cid" "$@"
}

echo "── Phase 3 exit criteria — stateful services ────────────"
echo "   Stack: $STACK"
echo ""

# ── Docker Swarm ──────────────────────────────────────────────────────────
check "Swarm is active" \
  "docker info --format '{{.Swarm.LocalNodeState}}' | grep -q active"

check "At least 1 Swarm node is Ready" \
  "docker node ls --format '{{.Status}}' | grep -q Ready"

# ── Secrets ───────────────────────────────────────────────────────────────
REQUIRED_SECRETS=(pg_password minio_root_password session_secret
                  rtmp_key_encryption_key centrifugo_secret chat_fingerprint_salt)
for s in "${REQUIRED_SECRETS[@]}"; do
  check "Docker secret '$s' exists" "docker secret inspect $s"
done

# ── Services health ───────────────────────────────────────────────────────
check "Postgres container is running" \
  "docker ps -f 'name=${STACK}_postgres' | grep -q Up"

check "Postgres accepts connections" \
  "container_exec postgres pg_isready -U tahti"

check "Redis container is running" \
  "docker ps -f 'name=${STACK}_redis' | grep -q Up"

check "Redis PING returns PONG" \
  "container_exec redis redis-cli ping | grep -q PONG"

check "MinIO container is running" \
  "docker ps -f 'name=${STACK}_minio' | grep -q Up"

check "MinIO health endpoint responds" \
  "container_exec minio curl -sf http://localhost:9000/minio/health/live"

# ── MinIO buckets ─────────────────────────────────────────────────────────
for bucket in audio covers hls-live recordings backups; do
  check "MinIO bucket '$bucket' exists" \
    "mc ls tahti/${bucket}/ &>/dev/null || container_exec minio mc ls local/${bucket}/"
done

# ── Backup scripts ────────────────────────────────────────────────────────
check "backup-postgres.sh is executable" \
  "test -x scripts/backup-postgres.sh"

check "backup-minio.sh is executable" \
  "test -x scripts/backup-minio.sh"

check "restore-test.sh is executable" \
  "test -x scripts/restore-test.sh"

check "Cron files installed" \
  "test -f /etc/cron.d/tahti-backup && test -f /etc/cron.d/tahti-restore-test"

# ── Backup exists ─────────────────────────────────────────────────────────
check "At least one Postgres backup exists in MinIO" \
  "mc ls tahti/backups/pg/ 2>/dev/null | grep -q '.sql.gz' || true"

# ── No failed tasks ───────────────────────────────────────────────────────
check "No failed Swarm tasks in stack" \
  "! docker stack ps ${STACK} --filter desired-state=running --format '{{.CurrentState}}' | grep -q 'Failed'"

# ── Prometheus ────────────────────────────────────────────────────────────
check "Prometheus is running" \
  "docker ps -f 'name=${STACK}_prometheus' | grep -q Up"

echo ""
echo "── Results ──────────────────────────────────────────────"
echo "   Passed: $PASS / Failed: $FAIL"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "PHASE 3 EXIT CRITERIA: FAILED"
  exit 1
else
  echo "PHASE 3 EXIT CRITERIA: ALL PASSED ✓"
  echo ""
  echo "Next: make deploy TAG=<sha> to deploy app services (Phase 4)"
  exit 0
fi
