#!/usr/bin/env bash
# Pre-launch production readiness checks (ops handover).
#
# Usage (Swarm manager):
#   ./scripts/check-prod-readiness.sh
#   STACK_ENV=/srv/tahti/stack.env ./scripts/check-prod-readiness.sh
#
# Combines M7 Mixcloud, backup cron presence, and optional email bounce secret.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STACK_ENV="${STACK_ENV:-/srv/tahti/stack.env}"
fail=0

section() { echo ""; echo "── $1 ──"; }

section "Mixcloud (M7)"
if "${ROOT}/scripts/check-mixcloud-prod.sh"; then
  :
else
  fail=1
fi

section "Backup cron (M29)"
if [[ -f /etc/cron.d/tahti-backup ]]; then
  echo "OK  /etc/cron.d/tahti-backup installed"
else
  echo "FAIL /etc/cron.d/tahti-backup missing — run: sudo ${ROOT}/scripts/install-crons.sh"
  fail=1
fi
if [[ -f /etc/cron.d/tahti-backup-drill ]]; then
  echo "OK  /etc/cron.d/tahti-backup-drill installed"
else
  echo "WARN /etc/cron.d/tahti-backup-drill missing (quarterly drill)"
fi

section "Email bounces (M13)"
if [[ -f "$STACK_ENV" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$STACK_ENV" && set +a
  if [[ -n "${EMAIL_BOUNCE_WEBHOOK_SECRET:-}" ]]; then
    echo "OK  EMAIL_BOUNCE_WEBHOOK_SECRET set"
  else
    echo "WARN EMAIL_BOUNCE_WEBHOOK_SECRET empty — bounce webhook unauthenticated in prod"
  fi
else
  echo "WARN stack.env not found — skip email check"
fi

section "Status monitoring (M11)"
if [[ -f "${ROOT}/scripts/status-monitor.sh" ]]; then
  echo "OK  status-monitor.sh present (run manually or enable STATUS_MONITOR_ENABLED GHA)"
else
  echo "FAIL status-monitor.sh missing"
  fail=1
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "Production readiness check passed (warnings may still apply)."
  exit 0
fi
echo "Production readiness check failed."
exit 1
