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

**Operator drill** (quarterly timed exercise):

```bash
chmod +x scripts/backup-drill.sh   # once after clone
sudo ./scripts/backup-drill.sh     # restore-test + status; logs to /var/log/tahti-backup-drill.log
```

Install host cron: `sudo ./scripts/install-crons.sh` → `/etc/cron.d/tahti-backup`

Legacy wrappers (`backup-postgres.sh`, `backup-minio.sh`, `restore-test.sh`, `ops/backup-*.sh`) forward to `backup.sh`.

## Postgres backup and restore

Daily backups: `pg_dump` → `backups/pg/YYYYMMDD-HHMMSS.sql.gz` on the primary MinIO alias (`tahti`).
**Point-in-time recovery (PITR)** is not available with `pg_dump` alone — RPO is the last daily dump (~24h).
**pgBackRest** + WAL archiving remains deferred; use this procedure until then.

**Find the latest backup:**

```bash
mc ls tahti/backups/pg/ | tail -5
# or: ./scripts/backup.sh status
```

**Restore to a throwaway database** (verify backup integrity — same as weekly cron):

```bash
./scripts/backup.sh restore-test
# log: /var/log/tahti-restore-test.log
# last result: /var/log/tahti-restore-test-last.txt
```

**Restore production Postgres** (maintenance window; **destructive** — overwrites `tahti` database):

1. Announce maintenance; export ledger row count for post-restore comparison:
   `curl -sf https://api.tahti.live/api/transparency/ytd | jq .`
2. Scale writers to zero (Swarm stack `tahti`):
   ```bash
   docker service scale \
     tahti_api=0 tahti_web=0 \
     tahti_worker-media=0 tahti_worker-dist=0 tahti_worker-light=0 tahti_worker-edge-log=0 \
     tahti_orchestrator=0 tahti_chat=0
   ```
3. Pick backup key from step 1, e.g. `pg/20260605-030012.sql.gz`.
4. Restore into the running Postgres service:
   ```bash
   mc cat tahti/backups/pg/<KEY> | gunzip \
     | docker exec -i "$(docker ps -qf name=tahti_postgres | head -1)" \
       psql -U tahti -d tahti -v ON_ERROR_STOP=1
   ```
5. Apply any migrations newer than the backup:
   ```bash
   cd /srv/tahti && set -a && . stack.env && set +a
   TAG=<deployed-tag> ./scripts/db-migrate-deploy.sh --image
   ```
6. Scale services back to desired replicas; smoke-test:
   ```bash
   curl -sf https://api.tahti.live/health
   curl -sf https://api.tahti.live/api/transparency/ytd | jq .
   ```
7. Run `./scripts/backup.sh restore-test` within 7 days to confirm pipeline still healthy.

## MinIO backup and restore

Daily mirror: `./scripts/backup.sh minio` mirrors `audio`, `covers`, and `backups` from alias **`tahti`**
to DR alias **`tahti-dr`** (UpCloud bucket). Configure both aliases on the manager (`mc alias set …`).

**Verify mirror counts** (included in `backup.sh minio` output; 1% tolerance):

```bash
mc ls --recursive tahti/audio/ | wc -l
mc ls --recursive tahti-dr/audio/ | wc -l
```

**Restore a single object or prefix** (e.g. one artist’s archive item):

```bash
# List keys under a channel prefix
mc ls tahti/audio/channels/<channelId>/
# Copy one object back from DR
mc cp tahti-dr/audio/channels/<channelId>/<file> tahti/audio/channels/<channelId>/<file>
```

**Restore an entire bucket from DR** (incident recovery — use only when primary MinIO data is lost):

1. Stop writers (same scale command as Postgres restore).
2. Confirm DR has expected object counts (`backup.sh minio` or manual `mc ls`).
3. Mirror DR → primary for affected buckets:
   ```bash
   mc mirror --overwrite tahti-dr/audio/ tahti/audio/
   mc mirror --overwrite tahti-dr/covers/ tahti/covers/
   ```
4. Bring services back; spot-check archive playback and release downloads.

**Full DR cutover** (primary site unavailable): promote **`tahti-dr`** as the read origin — see below.

## DR read-only cutover

Use when the primary VPS or MinIO volume is unavailable but UpCloud DR mirror is intact.

1. **Confirm DR data:** `mc ls tahti-dr/backups/pg/` and `./scripts/backup.sh status` on a host with DR alias.
2. **Postgres:** restore latest `pg/*.sql.gz` from `tahti-dr` into a promoted Postgres instance (UpCloud managed DB or fresh Swarm `postgres` service). Update `DATABASE_URL` in `stack.env`.
3. **Object storage:** point `MINIO_ENDPOINT` / public CDN at the DR bucket endpoint, or `mc mirror tahti-dr/…` to a new primary once hardware is rebuilt.
4. **Read-only mode** — set on API/worker env until primary is trusted again:
   - Disable uploads, live ingest, Stripe checkout (maintenance banner on web).
   - Scale `orchestrator`, `rtmp-ingest`, `icecast` to 0.
5. **DNS:** Caddy `stream.tahti.live` / API hostname → DR origin IP; keep TTL low during cutover.
6. **Post-incident:** restore-test within 7 days; document in incident log; rebuild primary and re-enable writes.

See also `docs/technical/journey-ops.md` (Journey 4 — backup drill).

## Monitoring

- **Upptime** (public status page): [`ops/upptime/README.md`](upptime/README.md) — monitors `/api/v1/status` and `/health`.
- **Interim uptime GHA** (until Upptime fork): `.github/workflows/status-monitor.yml` — hourly when repo var `STATUS_MONITOR_ENABLED=true`; manual `./scripts/status-monitor.sh`.
- **Tor exit bundled list**: weekly `.github/workflows/tor-exit-sync.yml` opens a PR; worker `tor-exit-list-sync` updates Redis daily; CI runs `pnpm tor-exit:check`.
- Backup age: `./scripts/backup.sh status` (env: `BACKUP_WARN_AGE_HOURS=26`, `BACKUP_PAGE_AGE_HOURS=48`).
  Also prints `minio_dr_postgres_backup_age_hours` when `DST_ALIAS` (default `tahti-dr`) is configured.
- Prometheus: `tahti_postgres_backup_age_hours` on `GET /metrics` (lists MinIO `backups/pg/` from API).
- Cron runs status check daily at 03:30 UTC after backup (see `install-crons.sh`).
- Weekly restore-test log: `/var/log/tahti-restore-test.log`
- Worker BullMQ crons: `apps/worker/src/cron-manifest.ts`

## Operator drills (quarterly)

| Drill | Command / check | Pass criteria |
|-------|-----------------|---------------|
| Backup freshness | `./scripts/backup.sh status` | exit 0; age &lt; 26h |
| Restore integrity | `./scripts/backup.sh restore-test` | log ends with `PASSED`; tables &gt; 0 |
| DR mirror | `./scripts/backup.sh minio` | DR object counts within 1% of primary |
| Metrics | `curl -s localhost:3001/metrics \| grep tahti_postgres_backup` | gauge ≥ 0, not `-1` |

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

Archive tracklist title lookup (STREAM-008): **AcoustID** chromaprint fallback on archive/live polling. **ACRCloud** is disabled until post-production (`ACRCLOUD_ENABLED=false`; no ingest audio samples).

**Secrets on manager** (AcoustID only for launch):

```bash
echo -n "$ACOUSTID_KEY" | docker secret create acoustid_api_key -
```

**Post-production ACRCloud** (when ready): create `acrcloud_access_key` / `acrcloud_access_secret`, set `ACRCLOUD_ENABLED=true` on **api**, `FINGERPRINT_SEND_AUDIO=1` on **orchestrator**, redeploy.

**Ingest replicas (prod Swarm):** label two nodes `ingest_id=a` and `ingest_id=b`; deploy `icecast`/`rtmp-ingest` on **a**, `icecast-b`/`rtmp-ingest-b` on **b**. DNS:

- `ingest.tahti.live`, `ingest-b.tahti.live` → RTMP (port 1935 on each node)
- `ingest-icecast.tahti.live`, `ingest-icecast-b.tahti.live` → Caddy → Icecast

Optional local failover profiles:

```bash
docker compose -f infra/docker-compose.stack.yml --profile icecast-failover up -d icecast-b
docker compose -f infra/docker-compose.stack.yml --profile rtmp-failover up -d rtmp-ingest-b
```

## Swagger `/docs` credentials (PLAT-005)

Production API reads basic-auth credentials from Docker secrets (`DOCS_USER_FILE`, `DOCS_PASS_FILE` in `docker-stack.yml`). Local dev defaults to `tahti` / `changeme`; production logs a warning if the password is still `changeme`.

**Create or rotate secrets on the Swarm manager:**

```bash
echo -n "tahti" | docker secret create docs_user -
openssl rand -base64 24 | docker secret create docs_pass -
# To rotate: docker secret rm docs_pass (after service update removes old ref)
docker service update --secret-rm docs_pass tahti_api
echo -n "$(openssl rand -base64 24)" | docker secret create docs_pass_v2 -
docker service update --secret-add docs_pass_v2 tahti_api
```

OpenAPI UI: `https://api.tahti.live/docs`

## Mixcloud OAuth (M7 production)

1. Create a Mixcloud developer app; set redirect URI to `https://api.tahti.live/api/me/mixcloud/oauth/callback`.
2. Put **client ID** in `stack.env` as `MIXCLOUD_CLIENT_ID` (public; not a Docker secret).
3. Store **client secret** as Swarm secret `mixcloud_client_secret` (mounted as `MIXCLOUD_CLIENT_SECRET_FILE` on **api** and **worker-media**).
4. Redeploy stack; artists connect via Dashboard → Distribution → Mixcloud.

Without `MIXCLOUD_CLIENT_ID`, OAuth and uploads stay in stub mode (CI/dev).
