#!/usr/bin/env bash
# Public HLS manifest concurrency smoke test.
# Usage: scripts/channel-load-test.sh [manifest_url] [listeners] [requests_per_listener]
# Example: scripts/channel-load-test.sh http://localhost:15011/hls/demo/master.m3u8 25 4
set -euo pipefail

URL="${1:-${HLS_MANIFEST_URL:-http://localhost:15011/hls/tahti-radio/master.m3u8}}"
LISTENERS="${2:-${HLS_LOAD_LISTENERS:-10}}"
REQUESTS="${3:-${HLS_LOAD_REQUESTS:-3}}"

for value in "$LISTENERS" "$REQUESTS"; do
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || { echo "listener/request counts must be positive integers" >&2; exit 2; }
done
command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 2; }
command -v xargs >/dev/null 2>&1 || { echo "xargs is required" >&2; exit 2; }

TOTAL=$((LISTENERS * REQUESTS))
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

request() {
  local id="$1"
  local start end elapsed status
  start=$(date +%s%3N)
  status=$(curl --silent --show-error --location --max-time 10 \
    --output /dev/null --write-out '%{http_code}' "$URL" 2>"$TMP_DIR/${id}.err" || true)
  end=$(date +%s%3N)
  elapsed=$((end - start))
  printf '%s %s %s\n' "$status" "$elapsed" "$id" >"$TMP_DIR/${id}.result"
}
export URL TMP_DIR
export -f request

seq 1 "$TOTAL" | xargs -P "$LISTENERS" -n 1 bash -c 'request "$1"' _

success=$(awk '$1 ~ /^2[0-9][0-9]$/ { count++ } END { print count + 0 }' "$TMP_DIR"/*.result)
failed=$((TOTAL - success))
avg_ms=$(awk '{ sum += $2 } END { if (NR) printf "%.0f", sum / NR; else print 0 }' "$TMP_DIR"/*.result)
max_ms=$(awk 'BEGIN { max = 0 } { if ($2 > max) max = $2 } END { print max + 0 }' "$TMP_DIR"/*.result)

printf 'HLS load test: url=%s requests=%d concurrency=%d success=%d failed=%d avg_ms=%s max_ms=%s\n' \
  "$URL" "$TOTAL" "$LISTENERS" "$success" "$failed" "$avg_ms" "$max_ms"

if (( failed > 0 )); then
  awk '$1 !~ /^2[0-9][0-9]$/ { print "failure: status=" $1 " request=" $3 }' "$TMP_DIR"/*.result >&2
  exit 1
fi
