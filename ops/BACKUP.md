# Tahti backup — RPO/RTO and operations

Operational backup for Postgres and MinIO. Implementation lives in `scripts/backup.sh`; procedures in `ops/RUNBOOK.md`.

## Targets

| Asset | Method | RPO | RTO (target) | Offsite |
|-------|--------|-----|--------------|---------|
| Postgres | `pg_dump` → `backups/pg/` on MinIO | 24h (daily cron) | 4h drill | UpCloud bucket mirror |
| MinIO `audio`, `covers`, `backups` | `mc mirror` to DR alias | 24h | 8h | Same |
| Live HLS (`hls-live`) | Short TTL; not in long-term backup | — | — | — |

## Cron (see `scripts/install-crons.sh`)

| Schedule | Command |
|----------|---------|
| Daily 03:00 UTC | `scripts/backup.sh all` |
| Weekly Sunday 05:00 UTC | `scripts/backup.sh restore-test` |
| Daily | `scripts/backup.sh status` (monitoring hook) |

## Environment

| Variable | Purpose |
|----------|---------|
| `MINIO_ALIAS` | mc alias for primary MinIO |
| `DST_ALIAS` | mc alias for DR / offsite |
| `BACKUP_BUCKET` | Bucket holding `pg/` dumps |
| `BACKUP_WARN_AGE_HOURS` | Warn if latest PG dump older than this (default 26) |
| `BACKUP_PAGE_AGE_HOURS` | Critical if older than this (default 48) |

## Verification

- Restore test writes results to `/var/log/tahti-restore-test-last.txt`
- MinIO mirror logs primary vs DR object counts (1% tolerance per bucket)

## Escalation

1. Check `backup.sh status` exit code (0 OK, 1 WARN, 2 CRITICAL)
2. Follow `ops/RUNBOOK.md` restore sections
3. Board + director notified if RPO exceeded > 48h
