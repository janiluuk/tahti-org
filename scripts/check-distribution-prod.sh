#!/usr/bin/env bash
# PLAT-056 / PLAT-057 — verify distribution integrations (Mixcloud + Revelator).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

section() { echo ""; echo "── $1 ──"; }

section "Mixcloud (PLAT-057)"
if "${ROOT}/scripts/check-mixcloud-prod.sh"; then
  :
else
  fail=1
fi

section "Revelator (PLAT-056)"
if "${ROOT}/scripts/check-revelator-prod.sh"; then
  :
else
  fail=1
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "Distribution go-live check passed."
  exit 0
fi
echo "Distribution go-live check failed."
exit 1
