# Cron consolidation

Goal: fewer registered BullMQ repeatables (28 → 23 in PR 1, → 17 in PR 2) without dropping behaviour.

## PR 1 — daily/weekly dispatchers (this branch)

- [x] `CronJobSpec.subTasks` + `cronTaskNames()`; `runCronTasks` (per-task CronRun rows, isolated failures, no rethrow)
- [x] `fan-sub-daily`, `membership-daily`, `weekly-monday`, `media-daily-sweeps` (same lane per dispatcher)
- [x] Admin cron dashboard expands dispatchers into per-task rows
- [ ] Verify in prod after deploy: 4 new CronRun names appear per task, old repeatables gone (cron-runner resets them on boot)

## PR 2 — minute / 10-minute ticks (stacked on PR 1)

- [x] `media-minute-tick` (watchdog, slot-switchover, fallback-reconciler), `light-minute-tick` (cap-tick, post-publish-notify), `media-ten-minute-tick` (sidecar-cleanup, sound-fallback-cache-sync) → 23 → 19 entries
- [x] `runCronTasks({ parallel: true })` so a slow watchdog (~40s seen live) cannot delay slot switchover
- [ ] Verify in prod after deploy: per-task CronRun rows keep ticking at the old cadence
- Left alone: `internet-radio-now-playing-sync` (dist lane, no same-lane 10-min sibling), `listen-session-close` (*/3), `missed-live-show-scan` (hourly), hls-minio-sync (4s), hls-caddy-egress-sync (edge-only), monthly/annual money jobs

- [x] `light-daily` (05:30): tor-exit-list-sync → download-fraud-scan → live-show-recurrence-generate → 19 → 17. `mention-digest` stays separate (user-facing 18:00 timing); `membership-daily` stays at 07:00 (emails).
