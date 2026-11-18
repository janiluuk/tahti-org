#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Bring Tahti Radio (and optionally Selects) back up on the production host.
#
# Run on vimage (or: ssh vimage 'bash -s' < scripts/recover-tahti-radio.sh):
#   ./scripts/recover-tahti-radio.sh
#   ./scripts/recover-tahti-radio.sh --selects
#
# Clears the STREAM-005 watchdog restart counter so a prior burst cannot block
# recovery, then asks the orchestrator (via the API admin restart path inside
# the stack) / docker to respawn Liquidsoap.
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/srv/tahti}"
INCLUDE_SELECTS=0
for arg in "$@"; do
  case "$arg" in
    --selects) INCLUDE_SELECTS=1 ;;
    -h|--help)
      echo "Usage: $0 [--selects]"
      exit 0
      ;;
  esac
done

cd "$DEPLOY_PATH"

echo "== containers =="
docker ps -a --format 'table {{.Names}}\t{{.Status}}' | rg -i 'tahti-channel-tahti-radio|tahti-channel-tahti-selects|orchestrator|worker-media|stack-api' || true

echo "== clear watchdog restart counters =="
REDIS_CID="$(docker ps -qf name=tahti-stack-redis --format '{{.ID}}' | head -1)"
if [[ -n "$REDIS_CID" ]]; then
  docker exec "$REDIS_CID" redis-cli --scan --pattern 'channel:watchdog:restarts:*' | while read -r key; do
    [[ -z "$key" ]] && continue
    docker exec "$REDIS_CID" redis-cli DEL "$key" >/dev/null
    echo "deleted $key"
  done
else
  echo "redis container not found — skip counter clear"
fi

API_CID="$(docker ps -qf name=tahti-stack-api --format '{{.ID}}' | head -1)"
ORCH_CID="$(docker ps -qf name=tahti-stack-orchestrator --format '{{.ID}}' | head -1)"

restart_via_api() {
  local slug="$1"
  if [[ -z "$API_CID" ]]; then
    echo "api container missing — cannot POST /api/admin/channels/$slug/restart"
    return 1
  fi
  # Internal board restart needs a session; use orchestrator spawn via docker exec instead.
  return 1
}

spawn_via_orchestrator() {
  local slug="$1"
  local template="${2:-channel}"
  if [[ -z "$ORCH_CID" ]]; then
    echo "orchestrator container missing"
    return 1
  fi
  # Resolve channel + open broadcast ids inside the API container (has Prisma).
  if [[ -z "$API_CID" ]]; then
    echo "api container missing — cannot resolve channel ids"
    return 1
  fi
  local ids
  ids="$(docker exec "$API_CID" node -e "
const { PrismaClient } = require('@tahti/db');
const p = new PrismaClient();
(async () => {
  const ch = await p.channel.findUnique({
    where: { slug: process.argv[1] },
    select: {
      id: true,
      broadcasts: { where: { endedAt: null }, orderBy: { startedAt: 'desc' }, take: 1, select: { id: true } },
    },
  });
  if (!ch) { console.error('missing channel'); process.exit(2); }
  let b = ch.broadcasts[0];
  if (!b) {
    b = await p.broadcast.create({ data: { channelId: ch.id, source: 'ICECAST' }, select: { id: true } });
  }
  await p.channel.update({ where: { id: ch.id }, data: { state: 'LIVE' } });
  console.log(JSON.stringify({ channelId: ch.id, broadcastId: b.id }));
  await p.\$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
" "$slug")"
  echo "ids for $slug: $ids"
  local channelId broadcastId
  channelId="$(printf '%s' "$ids" | sed -n 's/.*"channelId":"\([^"]*\)".*/\1/p')"
  broadcastId="$(printf '%s' "$ids" | sed -n 's/.*"broadcastId":"\([^"]*\)".*/\1/p')"
  if [[ -z "$channelId" || -z "$broadcastId" ]]; then
    echo "failed to resolve ids"
    return 1
  fi
  docker exec "$ORCH_CID" wget -qO- --post-data="{\"channelId\":\"$channelId\",\"slug\":\"$slug\",\"broadcastId\":\"$broadcastId\",\"template\":\"$template\"}" \
    --header='Content-Type: application/json' \
    http://127.0.0.1:3002/restart || \
  docker exec "$ORCH_CID" node -e "
fetch('http://127.0.0.1:3002/restart', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (process.env.INTERNAL_SECRET || '') },
  body: JSON.stringify({
    channelId: '$channelId',
    slug: '$slug',
    broadcastId: '$broadcastId',
    template: '$template',
  }),
}).then(async (r) => { console.log(r.status, await r.text()); if (!r.ok) process.exit(1); });
"
}

echo "== restart tahti-radio =="
spawn_via_orchestrator tahti-radio channel || true

if [[ "$INCLUDE_SELECTS" -eq 1 ]]; then
  echo "== restart tahti-selects =="
  spawn_via_orchestrator tahti-selects rotation || true
fi

echo "== wait for HLS =="
sleep 8
curl -sI -m 10 https://tahti.live/hls/tahti-radio/master.m3u8 | head -5 || true
docker ps -a --format 'table {{.Names}}\t{{.Status}}' | rg -i 'tahti-channel-tahti-radio|tahti-channel-tahti-selects' || true
echo "done"
