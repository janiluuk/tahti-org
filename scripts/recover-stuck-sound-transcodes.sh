#!/usr/bin/env bash
#
# List and re-queue sounds stuck PENDING/PROCESSING (raw file present, no live
# transcode-sound job) via the board admin API.
#
# Usage:
#   TAHTI_BOARD_EMAIL=… TAHTI_BOARD_PASSWORD=… ./scripts/recover-stuck-sound-transcodes.sh
#   ./scripts/recover-stuck-sound-transcodes.sh --list-only
#   API_BASE=https://api.tahti.live ./scripts/recover-stuck-sound-transcodes.sh
#
# Loops until the stuck list is empty or MAX_ROUNDS is hit (default 10).
# Each requeue call processes up to the API's stuck-list limit (~20).
#
set -euo pipefail

API_BASE="${API_BASE:-https://api.tahti.live}"
EMAIL="${TAHTI_BOARD_EMAIL:-}"
PASSWORD="${TAHTI_BOARD_PASSWORD:-}"
LIST_ONLY=0
MAX_ROUNDS="${MAX_ROUNDS:-10}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

for arg in "$@"; do
  case "$arg" in
    --list-only) LIST_ONLY=1 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "Set TAHTI_BOARD_EMAIL and TAHTI_BOARD_PASSWORD (board member)." >&2
  exit 1
fi

echo "==> Signing in as board at ${API_BASE}"
login="$(curl -sfS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -H 'content-type: application/json' \
  -d "$(jq -nc --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p}')" \
  "${API_BASE}/api/auth/login")"
if ! jq -e '.user.isBoard == true' >/dev/null <<<"$login"; then
  echo "Login succeeded but account is not board (or TOTP required)." >&2
  echo "$login" | jq . >&2 || echo "$login" >&2
  exit 1
fi

echo "==> Lane coverage"
curl -sfS -b "$COOKIE_JAR" "${API_BASE}/api/admin/workers" | jq '{
  workers: [.workers[] | {name, status, lanes}],
  laneCoverage
}'

round=1
while (( round <= MAX_ROUNDS )); do
  list="$(curl -sfS -b "$COOKIE_JAR" "${API_BASE}/api/admin/queues/media/stuck-pending")"
  total="$(jq -r '.total // 0' <<<"$list")"
  echo "==> Round ${round}: ${total} stuck sound(s)"
  jq -r '.sounds[]? | "\(.id)\t\(.status)\t\(.ownerUsername // "-")\t\(.title)"' <<<"$list" || true
  if [[ "$total" -eq 0 ]]; then
    echo "Nothing stuck. Done."
    exit 0
  fi
  if [[ "$LIST_ONLY" -eq 1 ]]; then
    exit 0
  fi
  echo "==> Re-queueing all listed…"
  curl -sfS -b "$COOKIE_JAR" \
    -H 'content-type: application/json' \
    -d '{"all":true}' \
    "${API_BASE}/api/admin/queues/media/stuck-pending/requeue" | jq .
  round=$((round + 1))
  sleep 2
done

echo "Hit MAX_ROUNDS=${MAX_ROUNDS}; run again if the list is still non-empty." >&2
exit 1
