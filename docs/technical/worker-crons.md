# Worker repeatable cron jobs

BullMQ repeatable jobs are declared in **`packages/shared/src/worker-cron-jobs.ts`** (`WORKER_CRON_JOBS` — single manifest for workers, API admin, and runbooks). The stack's single `cron-runner` service registers that manifest; worker replicas only execute the resulting jobs. Every execution is persisted in `CronRun` with outcome, returned JSON summary, error, and duration, visible at `/admin/crons`.

| Job | Schedule (UTC) | Note |
|---|---|---|
| `monthly-ledger-rollup` | 02:00 on day 2 each month | M8 |
| `annual-grant-calc` | 03:00 on 1 March | M9 |
| `media-minute-tick` | every minute | Dispatcher (media lane, parallel) — `channel-watchdog` (STREAM-005, restart Liquidsoap when HLS segments are stale), `radio-slot-switchover` (switch Tahti Radio to a booked artist live source at slot boundaries), `channel-fallback-reconciler` (bootstrap fallback-enabled artist channels into a 24/7 container) |
| `light-minute-tick` | every minute | Dispatcher (light lane, parallel) — `broadcast-cap-tick` (M20 free-tier live cap), `post-publish-notify` (M34 notify followers when a scheduled post crosses `publishAt`) |
| `media-ten-minute-tick` | every 10 min | Dispatcher (media lane, parallel) — `sidecar-cleanup` (remove orphaned recorder/fingerprint sidecars), `sound-fallback-cache-sync` (STREAM-009, refresh sound fallback cache) |
| `hls-minio-sync` | every 4s (`everyMs`, not cron) | STREAM-001 — mirror live HLS segments from volume to MinIO `hls-live` bucket; matches the Liquidsoap segment cadence so the manifest never runs dry |
| `hls-caddy-egress-sync` | every minute | STREAM-006 — aggregate Caddy HLS access log bytes into Redis (edge worker only) |
| `media-daily-sweeps` | daily 03:00 | Dispatcher — `sweep-editor-peaks-backfill` (PERF-04, backfill `editorPeaks` for READY archives), then `sweep-expired-stems` (delete stem output past its 7-day retention) |
| `fan-sub-daily` | daily 04:00 | Dispatcher (M19) — `fan-sub-payout`, `fan-sub-expire`, `fan-subscriber-purge` |
| `membership-daily` | daily 07:00 | Dispatcher (M1) — `membership-renewal-reminder`, then `membership-lapse` |
| `weekly-monday` | Monday 00:00 | Dispatcher — `weekly-broadcast-reset` (M20), then `tahti-selects-weekly-draw` |
| `tor-exit-list-sync` | daily 05:30 | M18 |
| `download-fraud-scan` | daily 06:00 | M18 |
| `mention-digest` | daily 18:00 | M15 — daily @-mention notification digest |
| `listen-session-close` | every 3 min | Close `ListenSession`s that stopped pinging (listen-time tracking) |
| `revelator-royalty-sync` | 04:00 on day 5 each month | M7 — pull Revelator royalty reports for the prior month |
| `live-show-recurrence-generate` | daily 03:15 | Roll recurring `LiveShowSeries` forward: generate missing `ScheduledLiveShow` occurrences up to each series' horizon |
| `missed-live-show-scan` | 5 min past every hour | Flag `ScheduledLiveShow`s whose start time passed with no `Broadcast`, notify the board |

**Dispatcher jobs** (`subTasks` in the manifest) run several related tasks in one tick, in order. Each sub-task is logged to `CronRun` under its own name, so `/admin/crons` still shows per-task history. A failing task is recorded and does not stop the ones after it; the dispatcher does not rethrow, so BullMQ never re-runs tasks that already succeeded (e.g. payouts). Sub-tasks of one dispatcher must belong to the same worker lane. Ordered dispatchers (daily/weekly) run tasks sequentially; the per-minute and per-10-minute ticks run them in parallel (`runCronTasks(..., { parallel: true })`) so one slow task, e.g. `channel-watchdog` waiting on the orchestrator, cannot delay `radio-slot-switchover`.

To add a cron: extend `WORKER_CRON_JOBS` in `packages/shared/src/worker-cron-jobs.ts`, implement the handler in `apps/worker/src/jobs/`, wire the job name in the worker dispatch in `index.ts`, and return a compact summary object so the Admin cron log records a useful result.

Host-level backups (Postgres, MinIO) are **not** in BullMQ — use `scripts/backup.sh` and `/etc/cron.d/tahti-backup` (see `ops/RUNBOOK.md`).
