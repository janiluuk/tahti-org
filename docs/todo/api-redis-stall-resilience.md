# api-redis-stall-resilience.md

**Status:** partial

## What

Stop a slow Redis from holding API requests for 10-60s, and remove what made Redis slow.

On 2026-09-22/23, disk `sdd` on vimage (`/opt`, holding all of `/opt/docker`, including the Redis, MinIO and Postgres volumes) was ~95% busy. It's a Kingston A400, a DRAM-less SATA SSD that collapses under sustained writes. Redis (AOF) stalled on it, and every Redis-backed request waited up to 5s per command (the node-redis default), for several commands in a row. The full evidence is in `tahti-player/docs/todo/api-slow-requests.md`.

What production Redis looked like on 2026-09-26:

- 1.15M keys and 1.77G of 2G. `bull:media:completed` held 1,095,150 records back to 2026-08-12, still growing by one every 4s (`hls-minio-sync`). `bull:media:failed` held 51,952.
- Stored repeat ticks lack `removeOnComplete`/`removeOnFail` even though `registerCrons` passes them. Without a Worker-level fallback, BullMQ keeps every record forever (`getKeepJobs` returns `{ count: -1 }`).
- Redis ran both AOF (1G) and RDB `save 3600 1 300 100 60 10000` (607 saves, ~25s each), rewriting the dataset every few minutes.

## Done on this branch (`fix/api-redis-timeout`)

- [x] API Redis client: command timeout `REDIS_COMMAND_TIMEOUT_MS` (default 500). `getOptionalRedisClient()`/`noteRedisFailure()` skip Redis for `REDIS_SLOW_BYPASS_MS` (default 5000) after a timeout, on the cache and rate-limit paths.
- [x] `json-cache` no longer awaits the cache write.
- [x] Worker-level `JOB_RETENTION` (`apps/worker/src/lib/job-retention.ts`) so every finished job is trimmed, including cron ticks.
- [x] `apps/worker/src/trim-finished-jobs.ts`: one-off batched cleanup (`Queue.clean`, 2000 per batch, keeps the last hour).
- [x] Redis: `--save ''` (AOF only; Redis isn't backed up) and `--no-appendfsync-on-rewrite yes`.
- [x] `/health`, `/metrics`, `/api/v1/status` and admin stats share one dependency probe for `HEALTH_CHECK_CACHE_MS` (default 5000).
- [x] Prisma `slow_query` warnings at or above `PRISMA_SLOW_QUERY_MS` (default 200; 0 disables). SQL text only, never params.
- [x] Alert rules `TahtiApiMeanLatencyHigh` and `TahtiVimageDiskSaturated`.

## Deploy order (important)

BullMQ's count-based trim deletes everything over the limit in **one Lua call**. If the new worker deploys while ~1.1M old records exist, the first finished job tries to delete them all at once and blocks Redis. So:

1. **Before deploying the worker**, trim the backlog in batches: `./scripts/trim-bullmq-backlog.sh` (add `SSH_VIA_NC=1` if `ssh vimage` gets "No route to host"). It runs a 1000-record test batch, aborts if that blocks Redis for over 1s, asks for confirmation, then runs the full trim inside the current worker container and prints before/after counts.
2. Deploy API + worker + cron-runner.
3. Recreate Redis so the new `--save ''` / `--no-appendfsync-on-rewrite` flags apply (brief restart). Optionally `BGREWRITEAOF` afterwards to shrink the AOF.
4. Deploy alert rules: `ops/monitoring/vimage6/deploy.sh`. Prometheus has no Alertmanager attached, so decide where alerts should go.

## Left

- [x] Step 1: backlog trimmed in production 2026-09-26 (1.15M keys / 1.77G to 1,318 keys / 25M; Redis latency avg 3.4ms, max 68ms during the trim; no slow API requests).
- [ ] Steps 2-4 above: deploy after merge.
- [ ] Longer term: move Docker's data root (or at least Redis/Postgres volumes) off the Kingston A400 `sdd`. vimage's NVMe LVM `/share/models` has 1.2T free. Moving MinIO to tahti.local ([`tahti-local-onboarding.md`](tahti-local-onboarding.md)) also takes MinIO's writes off this disk.
