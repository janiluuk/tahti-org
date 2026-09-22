# Worker lane-mismatch + MinIO storage cleanup

Status: **fixed in code + applied live to prod, redeploy pending**

## What happened (2026-09-22)

Production worker logs were spamming `lane-mismatch: <name> is not handled by
this worker's --queues` for `broadcast-cap-tick`, `channel-watchdog`,
`radio-slot-switchover`, `channel-fallback-reconciler`, `post-publish-notify`.

Root cause: PRs #539/#541 merged per-minute crons into dispatcher jobs
(`media-minute-tick`, `light-minute-tick`, ...) with `subTasks`. The `worker`/
`cron-runner` containers on prod (vimage) were running a **stale build** —
rsync had updated `/srv/tahti`'s source, but `docker compose build` was never
re-run, so the live `cron-runner` was still registering the old subtask
names as their own top-level BullMQ repeatables (confirmed: its boot log said
"26 cron jobs registered" vs. 17 top-level entries in the current manifest).
No current worker lane recognizes those bare names → lane-mismatch on every
tick.

Along the way, found and fixed a second bug: `cron-scheduler.ts`'s
`queue.add(job.name, {}, { repeat, jobId })` didn't pass
`removeOnComplete`/`removeOnFail` explicitly — BullMQ does not carry a
Queue's `defaultJobOptions` into the repeat template used for each
subsequent tick, only the first one. Confirmed live: Redis's `completed`
zset had grown to **1,028,843** stale job records, pushing `used_memory` to
1.55G/2G with `--maxmemory-policy allkeys-lru` (which silently *evicts* keys
under pressure instead of erroring — dangerous for BullMQ, which needs
`noeviction`). Both fixed.

Separately, `hls-live` MinIO bucket had accumulated **3.7M objects / 642GB**
(disk at 92%, 764G/880G) because `scripts/init-minio-buckets.sh` — which
sets bucket lifecycle expiry (hls-live 1d, recordings 7d, backups 90d) — was
never run against production (`mc ilm ls` showed zero rules on any bucket).
`hls-minio-sync.ts` uploads live segments every 4s per always-on channel and
nothing ever deleted them.

## What's done

- [x] `apps/worker/src/lib/cron-scheduler.ts` — pass `removeOnComplete`/
      `removeOnFail` explicitly into the repeat `add()` call.
- [x] `infra/docker-compose.stack.yml` — redis `--maxmemory-policy noeviction`
      (was `allkeys-lru`).
- [x] `apps/worker/src/lib/minio-lifecycle.ts` (new) — `ensureBucketLifecycles()`,
      idempotently applies the same rules as `init-minio-buckets.sh` via the
      S3 SDK; called from `cron-runner.ts` on every startup so this can't
      silently regress again.
- [x] `apps/worker/src/jobs/hls-live-prune.ts` (new) — `hls-live-prune` cron,
      added as a `media-ten-minute-tick` subtask (`worker-cron-jobs.ts`,
      `worker-job-lanes.ts`, `index.ts` dispatch): backstop that directly
      deletes `hls-live` objects older than 6h, independent of MinIO's own
      ILM scanner.
- [x] Applied the `mc ilm add` lifecycle rules directly against prod (not
      waiting for redeploy) — hls-live 1d / recordings 7d / backups 90d, all
      confirmed `Enabled` via `mc ilm ls`. MinIO's background scanner will
      reclaim the ~600GB over the following day or so.
- [x] `apps/worker/src/cron-manifest.test.ts` updated for the new subtask.
- [x] `docs/todo/e2e-screenshot-atlas.md` — separate, unrelated ask filed
      (richer e2e fixtures, 1280px capture, Atlas artifact for persistent
      screenshot comments) — not started.

## Remaining

- [ ] **Redeploy `worker` + `cron-runner`** on vimage so the code fixes
      actually take effect (the stale-build issue is the root cause of the
      original error — code alone doesn't fix a container that was never
      rebuilt). Scoped rebuild, not full `deploy_prod.sh` stack run, to limit
      blast radius: rsync + `docker compose build worker cron-runner` +
      `up -d --no-deps worker cron-runner`.
- [ ] After redeploy, verify: `cron-runner` log shows 17 (not 26) jobs
      registered; no more lane-mismatch errors; `bull:media:completed` zset
      stays capped near 500 after a few ticks.
- [ ] Confirm `hls-live` bucket size trending down over the next 24-48h
      (`mc admin info` / `du`).
- [ ] `docs/todo/HISTORY.md` and `docs/todo/INDEX.md` have a pre-existing
      unresolved git merge conflict (`UU`, unrelated to this task) —
      flagged to Jani, not touched here.
