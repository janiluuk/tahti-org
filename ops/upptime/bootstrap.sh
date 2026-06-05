#!/usr/bin/env bash
# Bootstrap checklist for a Tahti Upptime status repo (M11).
#
# Usage:
#   ./ops/upptime/bootstrap.sh
#   API_URL=https://api.tahti.live APP_URL=https://app.tahti.live ./ops/upptime/bootstrap.sh
#
# Does not create the GitHub fork — prints steps after probing live endpoints.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONFIG="${ROOT}/ops/upptime/upptime.config.example.yml"
API_URL="${API_URL:-https://api.tahti.live}"
APP_URL="${APP_URL:-https://app.tahti.live}"

green() { printf "\033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "\033[33m!\033[0m %s\n" "$1"; }

echo "── Tahti Upptime bootstrap ───────────────────────────────"
echo "API_URL=$API_URL"
echo "APP_URL=$APP_URL"
echo ""

if [[ ! -f "$CONFIG" ]]; then
  echo "Missing $CONFIG" >&2
  exit 1
fi

echo "── Probing endpoints (same checks as status-monitor) ─────"
API_URL="$API_URL" APP_URL="$APP_URL" bash "${ROOT}/scripts/status-monitor.sh"
green "All probes passed — safe to point Upptime at these URLs"
echo ""

echo "── Fork setup (manual) ───────────────────────────────────"
cat <<EOF
1. Create GitHub repo tahti-ry/status (fork https://github.com/upptime/upptime).

2. Copy site config:
     cp ops/upptime/upptime.config.example.yml → .upptimerc.yml in the fork
   Edit URLs if not production (current probe targets above).

3. Enable GitHub Actions + Pages on the fork (Upptime template docs).

4. DNS: CNAME status.tahti.live → <user>.github.io or Upptime Pages host.

5. When live, set repo variable STATUS_MONITOR_ENABLED=false here (optional)
   and link status.tahti.live from the web app footer.

6. Disable interim monitor only after 48 h of green Upptime history:
     GitHub → tahti-org/tahti → Settings → Variables → STATUS_MONITOR_ENABLED
EOF

echo ""
echo "── Config preview ────────────────────────────────────────"
head -20 "$CONFIG"
echo "…"
