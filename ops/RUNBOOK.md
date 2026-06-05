# Tahti operations runbook

Procedures for deploy, rollback, and disaster recovery. Config and application code
live in Git; this document covers **data** recovery (Postgres, MinIO).

## Prerequisites

- SSH access to the manager node (`DEPLOY_SSH_PRIVATE_KEY` in CI)
- `mc` alias configured for `registry.tahti.live` and backup bucket (see `scripts/backup.sh`)
- Docker Swarm stack name: `tahti` (production) or `tahti-staging`

## Deploy and rollback

Production deploys run via [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
on `v*.*.*` tags after staging smoke. Lab stack: [`deploy-lab-stack.yml`](../.github/workflows/deploy-lab-stack.yml).

**Rollback a single service** (production Swarm):

```bash
docker service rollback tahti_api
docker service rollback tahti_web
# repeat for worker-media, worker-light, chat, orchestrator, website
```

**Lab Compose stack** (ports 3010/3011):

```bash
cd /srv/tahti && TAG=<git-sha> ./scripts/stack-up.sh
```

## Backup (unified script)

All backup operations use **`scripts/backup.sh`**:

| Command | Purpose |
|---|---|
| `./scripts/backup.sh` or `all` | Postgres dump + MinIO DR mirror (daily cron) |
| `postgres` | `pg_dump` → `mc pipe tahti/backups/pg/YYYYMMDD-HHMMSS.sql.gz` |
| `minio` | Mirror `audio`, `covers`, `backups` to DR alias |
| `restore-test` | Weekly restore to throwaway Postgres (Sunday cron) |
| `status` | Print backup age; exit 1 if >26h, 2 if >48h (monitoring) |

Install host cron: `sudo ./scripts/install-crons.sh` → `/etc/cron.d/tahti-backup`

Legacy wrappers (`backup-postgres.sh`, `backup-minio.sh`, `restore-test.sh`, `ops/backup-*.sh`) forward to `backup.sh`.

## Postgres backup and restore

**Restore to a throwaway database** (verify backup integrity — same as weekly cron):

```bash
./scripts/backup.sh restore-test
```

**Restore production** (maintenance window; destructive):

1. Stop API, web, and workers so nothing writes during restore.
2. `mc cat tahti/backups/pg/<LATEST>.sql.gz | gunzip | docker exec -i tahti_postgres psql -U tahti -d tahti`
3. Run `./scripts/db-migrate-deploy.sh` (or `make db-migrate-deploy`) if schema drifted since backup.
4. Bring services back; smoke-test `/health` and ledger row count vs pre-incident export.

## MinIO backup and restore

Mirror: `./scripts/backup.sh minio` (included in `backup.sh all`).

**Restore a prefix** (e.g. one artist’s archive):

```bash
mc mirror tahti/backups/minio/<date>/ tahti/media/ --overwrite
```

Full bucket swap only during DR cutover — document DNS/Caddy target before switching.

## DR read-only cutover (outline)

1. Promote UpCloud replica Postgres + object storage per `docs/technical/infra-strategy.md`.
2. Point Caddy at read-only API origin; disable uploads and live ingest in env.
3. Post incident review + restore-test within 7 days.

## Monitoring

- **Upptime** (public status page): [`ops/upptime/README.md`](upptime/README.md) — monitors `/api/v1/status` and `/health`.
- Backup age: `./scripts/backup.sh status` (env: `BACKUP_WARN_AGE_HOURS=26`, `BACKUP_PAGE_AGE_HOURS=48`).
- Cron runs status check daily at 03:30 UTC after backup (see `install-crons.sh`).
- Weekly restore-test log: `/var/log/tahti-restore-test.log`
- Worker BullMQ crons: `apps/worker/src/cron-manifest.ts`

## Ingest failover env (STREAM-003 / STREAM-007)

Health-ranked ingest URLs on `GET /api/me/stream-settings` require comma-separated public host lists:

| Variable | Service | Health probe |
|----------|---------|--------------|
| `RTMP_INGEST_HOSTS` | api | `RTMP_INGEST_HEALTH_SCHEME` + port + `RTMP_INGEST_HEALTH_PATH` (default `/health`) |
| `ICECAST_INGEST_HOSTS` | api | `{host}/status-json.xsl` |

Set on **api** only. Example production:

```bash
ICECAST_INGEST_HOSTS=https://icecast-a.tahti.live,https://icecast-b.tahti.live
RTMP_INGEST_HOSTS=ingest-a.tahti.live,ingest-b.tahti.live
```

Archive tracklist title lookup (STREAM-008): **ACRCloud** at ingest (MP3 sample from sidecar when `FINGERPRINT_SEND_AUDIO=1`) with **AcoustID** chromaprint fallback on archive/live polling.

**Secrets on manager** (empty string disables lookup):

```bash
echo -n "$ACRCLOUD_KEY" | docker secret create acrcloud_access_key -
echo -n "$ACRCLOUD_SECRET" | docker secret create acrcloud_access_secret -
echo -n "$ACOUSTID_KEY" | docker secret create acoustid_api_key -
```

**Ingest replicas (prod Swarm):** label two nodes `ingest_id=a` and `ingest_id=b`; deploy `icecast`/`rtmp-ingest` on **a**, `icecast-b`/`rtmp-ingest-b` on **b**. DNS:

- `ingest.tahti.live`, `ingest-b.tahti.live` → RTMP (port 1935 on each node)
- `ingest-icecast.tahti.live`, `ingest-icecast-b.tahti.live` → Caddy → Icecast

Optional local failover profiles:

```bash
docker compose -f infra/docker-compose.stack.yml --profile icecast-failover up -d icecast-b
docker compose -f infra/docker-compose.stack.yml --profile rtmp-failover up -d rtmp-ingest-b
```
