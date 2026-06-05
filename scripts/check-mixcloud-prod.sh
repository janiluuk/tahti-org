#!/usr/bin/env bash
# M7 — verify Mixcloud OAuth is configured for production (not stub mode).
#
# Run on the Swarm manager after editing stack.env and creating secrets:
#   ./scripts/check-mixcloud-prod.sh
#   STACK_ENV=/srv/tahti/stack.env ./scripts/check-mixcloud-prod.sh
#
# Exit 0 when client ID + Swarm secret are present; exit 1 otherwise.

set -euo pipefail

STACK_ENV="${STACK_ENV:-/srv/tahti/stack.env}"
SECRET_NAME="${MIXCLOUD_SECRET_NAME:-mixcloud_client_secret}"
fail=0

ok() { printf "\033[32mOK\033[0m  %s\n" "$1"; }
bad() { printf "\033[31mFAIL\033[0m %s\n" "$1"; fail=1; }
warn() { printf "\033[33mWARN\033[0m %s\n" "$1"; }

echo "── Mixcloud production check (M7) ────────────────────────"
echo "stack.env: $STACK_ENV"
echo ""

if [[ ! -f "$STACK_ENV" ]]; then
  bad "stack.env not found (set STACK_ENV=)"
else
  # shellcheck disable=SC1090
  set -a && source "$STACK_ENV" && set +a
  if [[ -n "${MIXCLOUD_CLIENT_ID:-}" ]]; then
    ok "MIXCLOUD_CLIENT_ID is set (${#MIXCLOUD_CLIENT_ID} chars)"
  else
    bad "MIXCLOUD_CLIENT_ID is empty — OAuth stays in stub mode"
  fi
  if [[ -n "${MIXCLOUD_OAUTH_REDIRECT_URI:-}" ]]; then
    ok "MIXCLOUD_OAUTH_REDIRECT_URI=${MIXCLOUD_OAUTH_REDIRECT_URI}"
  else
    ok "MIXCLOUD_OAUTH_REDIRECT_URI will default to {API_URL}/api/me/mixcloud/oauth/callback"
  fi
fi

if command -v docker >/dev/null 2>&1; then
  if docker secret inspect "$SECRET_NAME" >/dev/null 2>&1; then
    ok "Docker secret ${SECRET_NAME} exists"
  else
    bad "Docker secret ${SECRET_NAME} missing — run: echo -n \"\$SECRET\" | docker secret create ${SECRET_NAME} -"
  fi

  if docker service inspect tahti_api >/dev/null 2>&1; then
    if docker service inspect tahti_api --format '{{range .Spec.TaskTemplate.ContainerSpec.Secrets}}{{.SecretName}} {{end}}' \
      | grep -q "$SECRET_NAME"; then
      ok "tahti_api mounts ${SECRET_NAME}"
    else
      warn "tahti_api may not mount ${SECRET_NAME} — redeploy stack after secret create"
    fi
  else
    warn "tahti_api service not found (not on manager or stack not deployed)"
  fi
else
  warn "docker not available — skipping secret/service checks"
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "Mixcloud production check passed."
  exit 0
fi
echo "Mixcloud production check failed — see RUNBOOK § Mixcloud OAuth."
exit 1
