# Worker repeatable cron jobs

BullMQ repeatable jobs are declared in **`packages/shared/src/worker-cron-jobs.ts`** (`WORKER_CRON_JOBS` — single manifest for worker, API admin, and runbooks), re-exported from `apps/worker/src/cron-manifest.ts`, and registered at worker startup from `apps/worker/src/index.ts`.

| Job | Schedule (UTC) | Note |
|---|---|---|
| `monthly-ledger-rollup` | 02:00 on day 2 each month | M8 |
| `annual-grant-calc` | 03:00 on 1 March | M9 |
| `broadcast-cap-tick` | every minute | M20 — free-tier live cap tick |
| `channel-watchdog` | every minute | STREAM-005 — restart Liquidsoap when HLS segments are stale |
| `radio-slot-switchover` | every minute | Switch Tahti Radio to a booked artist live source at slot boundaries |
| `channel-fallback-reconciler` | every minute | Bootstrap fallback-enabled artist channels into a running 24/7 container |
| `sidecar-cleanup` | every 10 min | Remove orphaned recorder/fingerprint sidecar containers left behind when a broadcast ends |
| `hls-minio-sync` | every 4s (`everyMs`, not cron) | STREAM-001 — mirror live HLS segments from volume to MinIO `hls-live` bucket; matches the Liquidsoap segment cadence so the manifest never runs dry |
| `hls-caddy-egress-sync` | every minute | STREAM-006 — aggregate Caddy HLS access log bytes into Redis (edge worker only) |
| `archive-fallback-cache-sync` | every 10 min | STREAM-009 — refresh local archive fallback cache for Liquidsoap |
| `weekly-broadcast-reset` | Monday 00:00 | M20 — reset weekly broadcast counters |
| `tahti-selects-weekly-draw` | Monday 01:00 | Re-draw the Tahti Selects rotation from opted-in tracks (max 3/artist, 50 total) |
| `fan-sub-payout` | daily 04:00 | M19 |
| `fan-sub-expire` | daily 05:00 | M19 |
| `fan-subscriber-purge` | daily 05:00 | M19 — cancel stale fan-subs for deleted accounts |
| `tor-exit-list-sync` | daily 05:30 | M18 |
| `download-fraud-scan` | daily 06:00 | M18 |
| `membership-renewal-reminder` | daily 07:00 | M1 |
| `mention-digest` | daily 18:00 | M15 — daily @-mention notification digest |
| `post-publish-notify` | every minute | M34 — notify followers when a scheduled post crosses its `publishAt` |
| `listen-session-close` | every 3 min | Close `ListenSession`s that stopped pinging (listen-time tracking) |
| `membership-lapse` | daily 08:00 | M1 |
| `revelator-royalty-sync` | 04:00 on day 5 each month | M7 — pull Revelator royalty reports for the prior month |
| `sweep-editor-peaks-backfill` | daily 03:00 | PERF-04 — backfill `editorPeaks` for READY archives missing pyramid data |
| `sweep-expired-stems` | daily 03:30 | Delete stem-separation output past its 7-day retention window |
| `live-show-recurrence-generate` | daily 03:15 | Roll recurring `LiveShowSeries` forward: generate missing `ScheduledLiveShow` occurrences up to each series' horizon |
| `missed-live-show-scan` | 5 min past every hour | Flag `ScheduledLiveShow`s whose start time passed with no `Broadcast`, notify the board |

To add a cron: extend `WORKER_CRON_JOBS` in `packages/shared/src/worker-cron-jobs.ts`, implement the handler in `apps/worker/src/jobs/`, and wire the job name in the worker `switch` in `index.ts`.

Host-level backups (Postgres, MinIO) are **not** in BullMQ — use `scripts/backup.sh` and `/etc/cron.d/tahti-backup` (see `ops/RUNBOOK.md`).
