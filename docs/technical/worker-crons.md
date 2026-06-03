# Worker repeatable cron jobs

BullMQ repeatable jobs are declared in **`apps/worker/src/cron-manifest.ts`** and registered at worker startup from `apps/worker/src/index.ts`.

| Job | Schedule (UTC) | Milestone |
|---|---|---|
| `monthly-ledger-rollup` | 02:00 on day 2 each month | M8 |
| `annual-grant-calc` | 03:00 on 1 March | M9 |
| `broadcast-cap-tick` | every minute | M20 |
| `weekly-broadcast-reset` | Monday 00:00 | M20 |
| `fan-sub-payout` | daily 04:00 | M19 |
| `fan-sub-expire` | daily 05:00 | M19 |
| `tor-exit-list-sync` | daily 05:30 | M18 |
| `download-fraud-scan` | daily 06:00 | M18 |
| `membership-renewal-reminder` | daily 07:00 | M1 |
| `membership-lapse` | daily 08:00 | M1 |

To add a cron: extend `WORKER_CRON_JOBS`, implement the handler in `apps/worker/src/jobs/`, and wire the job name in the worker `switch` in `index.ts`.

Host-level backups (Postgres, MinIO) are **not** in BullMQ — use `scripts/backup.sh` and `/etc/cron.d/tahti-backup` (see `ops/RUNBOOK.md`).
