#!/usr/bin/env bash
# Batch-delete finished BullMQ job records (older than 1h) from the production
# `media` queue. Run this BEFORE deploying a worker with count-based job
# retention to a large backlog: BullMQ's own trim deletes everything over the
# limit in one Lua call and would block Redis.
#
#   ./scripts/trim-bullmq-backlog.sh          # test batch, confirm, full run
#   ./scripts/trim-bullmq-backlog.sh --yes    # skip the confirmation prompt
#
# Env:
#   TRIM_HOST          ssh host (default: vimage)
#   SSH_VIA_NC=1       connect through `nc` (ProxyCommand), for when ssh's own
#                      connection is blocked (e.g. macOS local-network privacy)
#   MAX_BATCH_MS       abort if the test batch blocks Redis longer (default: 1000)
#   TRIM_BATCH         records per batch for the full run (default: 2000)
#   TRIM_PAUSE_MS      pause between batches (default: 200)
set -euo pipefail

HOST="${TRIM_HOST:-vimage}"
MAX_BATCH_MS="${MAX_BATCH_MS:-1000}"
SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/trim-bullmq-backlog.cjs"
WORKER=tahti-stack-worker-1
REDIS=tahti-stack-redis-1
ASSUME_YES=false
[[ "${1:-}" == "--yes" ]] && ASSUME_YES=true

SSH_ARGS=(-o BatchMode=yes)
[[ -n "${SSH_VIA_NC:-}" ]] && SSH_ARGS+=(-o 'ProxyCommand=nc %h %p')

remote() {
  ssh "${SSH_ARGS[@]}" "$HOST" "$1"
}

counts() {
  remote "R='docker exec $REDIS redis-cli'; echo \"completed=\$(\$R zcard bull:media:completed) failed=\$(\$R zcard bull:media:failed) keys=\$(\$R dbsize) \$(\$R info memory | grep used_memory_human | tr -d '\r')\""
}

run_trim() {
  ssh "${SSH_ARGS[@]}" "$HOST" "docker exec -i $* -w /app/apps/worker $WORKER node -" <"$SCRIPT"
}

echo "==> Before: $(counts)"

echo "==> Test batch (1000 records)"
test_out="$(run_trim -e TRIM_BATCH=1000 -e TRIM_MAX_BATCHES=1)"
echo "$test_out"
slowest="$(sed -n 's/.*"slowestMs":\([0-9]*\).*/\1/p' <<<"$test_out")"
if [[ -z "$slowest" ]]; then
  echo "Could not read test batch timing; aborting." >&2
  exit 1
fi
if ((slowest > MAX_BATCH_MS)); then
  echo "Test batch blocked Redis for ${slowest}ms (> ${MAX_BATCH_MS}ms); aborting. Try a smaller TRIM_BATCH." >&2
  exit 1
fi

if ! $ASSUME_YES; then
  read -r -p "Test batch took ${slowest}ms. Run the full trim? [y/N] " answer
  [[ "$answer" == [yY]* ]] || { echo "Aborted."; exit 0; }
fi

echo "==> Full trim"
run_trim -e "TRIM_BATCH=${TRIM_BATCH:-2000}" -e "TRIM_PAUSE_MS=${TRIM_PAUSE_MS:-200}"

echo "==> After: $(counts)"
