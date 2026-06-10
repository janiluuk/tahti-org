#!/usr/bin/env bash
# PLAT-056 — verify Revelator DSP distribution is configured for production (not stub mode).
#
# Run on the Swarm manager after creating the revelator_api_key secret:
#   ./scripts/check-revelator-prod.sh
#
# Exit 0 when Swarm secret exists and worker-dist mounts it; exit 1 otherwise.

set -euo pipefail

SECRET_NAME="${REVELATOR_SECRET_NAME:-revelator_api_key}"
fail=0

ok() { printf "\033[32mOK\033[0m  %s\n" "$1"; }
bad() { printf "\033[31mFAIL\033[0m %s\n" "$1"; fail=1; }
warn() { printf "\033[33mWARN\033[0m %s\n" "$1"; }

echo "── Revelator production check (PLAT-056) ─────────────────"
echo ""

if command -v docker >/dev/null 2>&1; then
  if docker secret inspect "$SECRET_NAME" >/dev/null 2>&1; then
    ok "Docker secret ${SECRET_NAME} exists"
  else
    bad "Docker secret ${SECRET_NAME} missing — run: echo -n \"\$KEY\" | docker secret create ${SECRET_NAME} -"
  fi

  for svc in tahti_api tahti_worker-dist; do
    if docker service inspect "$svc" >/dev/null 2>&1; then
      if docker service inspect "$svc" --format '{{range .Spec.TaskTemplate.ContainerSpec.Secrets}}{{.SecretName}} {{end}}' \
        | grep -q "$SECRET_NAME"; then
        ok "${svc} mounts ${SECRET_NAME}"
      else
        bad "${svc} does not mount ${SECRET_NAME} — redeploy stack after secret create"
      fi
    else
      warn "${svc} service not found (not on manager or stack not deployed)"
    fi
  done
else
  warn "docker not available — skipping secret/service checks"
fi

echo ""
echo "Manual go-live checklist (ops):"
echo "  • Revelator white-label account + API key in board vault"
echo "  • ISRC registrar account linked in Revelator (required for new tracks)"
echo "  • DPA / subprocessor terms reviewed — see /admin/settings/vendors"
echo "  • Test submit: dashboard → Releases → DSP distribution"
echo ""

if [[ "$fail" -eq 0 ]]; then
  echo "Revelator production check passed."
  exit 0
fi
echo "Revelator production check failed — see RUNBOOK § Revelator DSP."
exit 1
