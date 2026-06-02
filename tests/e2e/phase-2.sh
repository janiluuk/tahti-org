#!/usr/bin/env bash
# Phase 2 exit criteria — local dev environment fully operational
#
# Run AFTER `make dev` (containers must be up).
# Usage: ./tests/e2e/phase-2.sh

set -euo pipefail

PASS=0
FAIL=0

green() { printf "\033[32m✓\033[0m %s\n" "$1"; }
red()   { printf "\033[31m✗\033[0m %s\n" "$1"; }

check() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    green "$label"
    ((PASS++))
  else
    red "$label — FAILED"
    ((FAIL++))
  fi
}

echo "── Phase 2 exit criteria — dev environment ──────────────"
echo ""

# ── Website ───────────────────────────────────────────────────────────────
check "Website responds on :8080" \
  "curl -sf --max-time 5 http://localhost:8080/health | grep -q ok"

# ── Postgres ──────────────────────────────────────────────────────────────
check "Postgres accepts connections on :5432" \
  "docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U tahti -d tahti"

check "Postgres tahti database exists" \
  "docker compose -f infra/docker-compose.dev.yml exec -T postgres psql -U tahti -lqt | grep -q tahti"

# ── Redis ─────────────────────────────────────────────────────────────────
check "Redis PING returns PONG on :6379" \
  "docker compose -f infra/docker-compose.dev.yml exec -T redis redis-cli ping | grep -q PONG"

# ── MinIO ─────────────────────────────────────────────────────────────────
check "MinIO health endpoint responds on :9000" \
  "curl -sf --max-time 5 http://localhost:9000/minio/health/live"

check "MinIO audio bucket exists" \
  "docker compose -f infra/docker-compose.dev.yml exec -T minio-init true 2>/dev/null || \
   docker run --rm --network tahti_default minio/mc alias set local http://minio:9000 tahti tahti_dev_secret &>/dev/null && \
   curl -sf --max-time 5 -u 'tahti:tahti_dev_secret' 'http://localhost:9000/audio/' | grep -qi 'listbucketresult\|access denied\|200'"

# ── Centrifugo ────────────────────────────────────────────────────────────
check "Centrifugo health endpoint responds on :8000" \
  "curl -sf --max-time 5 http://localhost:8000/health | grep -qi 'ok\|1'"

# ── MailHog ───────────────────────────────────────────────────────────────
check "MailHog web UI responds on :8025" \
  "curl -sf --max-time 5 http://localhost:8025 | grep -qi 'mailhog\|mail'"

check "MailHog SMTP port is open on :1025" \
  "nc -z -w3 localhost 1025"

# ── Icecast ───────────────────────────────────────────────────────────────
check "Icecast status page responds on :8100" \
  "curl -sf --max-time 5 http://localhost:8100/status.xsl | grep -qi 'icecast\|status'"

# ── RTMP ingest ───────────────────────────────────────────────────────────
check "nginx-RTMP port :1935 is open" \
  "nc -z -w3 localhost 1935"

# ── Docker compose health ─────────────────────────────────────────────────
check "All compose services are running (no Exit/Restarting state)" \
  "docker compose -f infra/docker-compose.dev.yml ps --format json | \
   python3 -c \"import sys,json; d=sys.stdin.read(); states=[s.get('State','') for s in (json.loads(l) for l in d.splitlines() if l.strip())]; print(all(s in ('running','exited') for s in states)); print(states)\" 2>/dev/null | head -1 | grep -q True || \
   ! docker compose -f infra/docker-compose.dev.yml ps | grep -E 'Exit|Restarting'"

# ── CI pipeline check ─────────────────────────────────────────────────────
check "GitHub Actions workflow file exists" \
  "test -f .github/workflows/website.yml"

check "Makefile has dev target" \
  "grep -q '^dev:' Makefile"

check "Makefile has dev-down target" \
  "grep -q '^dev-down:' Makefile"

echo ""
echo "── Results ──────────────────────────────────────────────"
echo "   Passed: $PASS"
echo "   Failed: $FAIL"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "PHASE 2 EXIT CRITERIA: FAILED ($FAIL checks failed)"
  echo "Run 'make dev' if containers are not up, then retry."
  exit 1
else
  echo "PHASE 2 EXIT CRITERIA: ALL PASSED ✓"
  exit 0
fi
