# Tahti backup & disaster recovery reference

Quick reference for operators. Step-by-step restore commands live in
[`RUNBOOK.md`](RUNBOOK.md).

## RPO / RTO targets

| Asset | Method | RPO (max data loss) | RTO (target restore) | Notes |
|-------|--------|---------------------|----------------------|-------|
| Postgres | `pg_dump` → MinIO `backups/pg/` | ~24 h (daily dump) | 2–4 h maintenance window | PITR via pgBackRest **deferred** |
| MinIO objects | `mc mirror` primary → DR | ~24 h (daily mirror) | 1–3 h per bucket | 1% count tolerance in script |
| Redis / sessions | Not backed up | N/A | Rebuild on redeploy | Users re-login after major DR |
| Ledger integrity | Postgres restore | Same as Postgres | Verify via `/api/transparency/ytd` | Compare row counts pre/post |

## Cron schedule (UTC)

Installed by `sudo ./scripts/install-crons.sh` on the Swarm manager:

| Schedule | Job | Log |
|----------|-----|-----|
| `0 3 * * *` | `backup.sh all` (Postgres + MinIO DR) | `/var/log/tahti-backup.log` |
| `30 3 * * *` | `backup.sh status` (age alert) | `/var/log/tahti-backup.log` |
| `0 5 * * 0` | `backup.sh restore-test` (weekly) | `/var/log/tahti-restore-test.log` |
| `0 6 1 1,4,7,10 *` | `backup-drill.sh` (quarterly) | `/var/log/tahti-backup-drill.log` |

## MinIO aliases & buckets

| Alias | Role | Typical buckets / prefixes |
|-------|------|----------------------------|
| `tahti` | Primary (on-site) | `audio/`, `covers/`, `backups/pg/` |
| `tahti-dr` | DR mirror (UpCloud) | Same prefixes mirrored daily |

Configure with `mc alias set` on the manager. Env overrides: `SRC_ALIAS`, `DST_ALIAS`,
`BACKUP_BUCKET` (default `backups`), `MINIO_ALIAS` (default `tahti`).

## Monitoring & alerts

- **CLI:** `./scripts/backup.sh status` — exit 1 if backup age &gt; 26 h, exit 2 if &gt; 48 h
- **Prometheus:** `tahti_postgres_backup_age_hours` on `GET /metrics`
- **Quarterly drill pass criteria:** restore-test exit 0 + status exit 0 (see RUNBOOK drills table)

## Escalation

| Severity | Condition | Action |
|----------|-----------|--------|
| WARN | Backup age 26–48 h | Check cron + `/var/log/tahti-backup.log`; run `backup.sh all` manually |
| CRITICAL | Backup age &gt; 48 h or restore-test failed | Page on-call operator; do not deploy schema migrations until backups verified |
| DR event | Primary site unavailable | Follow RUNBOOK **DR read-only cutover**; notify board + status page |

**On-call:** Tahti ry operators roster (see governance). Until roster is formalized, escalate to
the director and whoever holds Swarm manager SSH access.

## Related

- [`RUNBOOK.md`](RUNBOOK.md) — restore procedures, rollback, ingest env
- [`secrets-management.md`](secrets-management.md) — Swarm secrets
- [`INCIDENTS.md`](INCIDENTS.md) — outage communications
