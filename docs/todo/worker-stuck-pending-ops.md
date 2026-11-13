# Recover stuck PENDING sound transcodes (ops)

**Status:** open

Code for lane hand-off, sweep, admin stuck requeue, and
`clearFinishedJob` on `hearthis-export` is on `main` / this PR. Production
still needs a confirmed worker redeploy and a drain of leftover PENDING
sounds.

## Do on LAN (vimage)

1. `./scripts/redeploy-media-workers.sh` (stack worker + cron-runner +
   vimage7 transcode), or a full `./scripts/deploy_prod.sh` if preferred.
2. Board: `GET /api/admin/workers` — every lane in `laneCoverage` has
   `onlineWorkers > 0`; no new `lane-mismatch` flood in failed jobs.
3. `TAHTI_BOARD_EMAIL=… TAHTI_BOARD_PASSWORD=… ./scripts/recover-stuck-sound-transcodes.sh`
   (or Admin → Status stuck PENDING panel) until the list is empty.
4. Spot-check a few IDs reach `READY` with `mp3Key`.

## Scripts

- [`scripts/redeploy-media-workers.sh`](../../scripts/redeploy-media-workers.sh)
- [`scripts/recover-stuck-sound-transcodes.sh`](../../scripts/recover-stuck-sound-transcodes.sh)
