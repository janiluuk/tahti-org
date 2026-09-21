# Cron consolidation

Goal: fewer registered BullMQ repeatables (28 → 23 in PR 1, → ~16 in PR 2) without dropping behaviour.

## PR 1 — daily/weekly dispatchers (this branch)

- [x] `CronJobSpec.subTasks` + `cronTaskNames()`; `runCronTasks` (per-task CronRun rows, isolated failures, no rethrow)
- [x] `fan-sub-daily`, `membership-daily`, `weekly-monday`, `media-daily-sweeps` (same lane per dispatcher)
- [x] Admin cron dashboard expands dispatchers into per-task rows
- [ ] Verify in prod after deploy: 4 new CronRun names appear per task, old repeatables gone (cron-runner resets them on boot)

## PR 2 — stacked on PR 1

- `minute-tick`: broadcast-cap-tick, channel-watchdog, radio-slot-switchover, channel-fallback-reconciler, post-publish-notify — lanes differ (light vs media), so split by lane or move lanes first
- `ten-minute-tick`: sidecar-cleanup, sound-fallback-cache-sync (media), internet-radio-now-playing-sync (dist)

Kept separate on purpose: hls-minio-sync (4s), hls-caddy-egress-sync (edge-only), monthly/annual money jobs.
