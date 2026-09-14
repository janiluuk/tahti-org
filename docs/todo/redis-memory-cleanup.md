# Redis memory cap + BullMQ job retention

Status: **open** (implemented, checks pass, not yet pushed/PR'd)

## What this is

Three related Redis memory-growth fixes, all landed in one commit
(`6012875e`):

- **No eviction policy in prod.** `infra/docker-compose.stack.yml` — the
  file `scripts/deploy_prod.sh` actually deploys — had no `maxmemory` /
  eviction config at all, so Redis could grow unbounded and nothing was ever
  evicted. Added `maxmemory 2gb` + `allkeys-lru`, matching the value already
  used in the unused legacy `docker-stack.yml`.
- **Unbounded BullMQ job retention.** `apps/api/src/lib/queue.ts`,
  `apps/worker/src/lib/queue.ts`, `apps/worker/src/lib/cron-scheduler.ts`,
  and `apps/worker/src/jobs/sweep-editor-peaks-backfill.ts` mostly had no
  `removeOnComplete`/`removeOnFail`, so BullMQ's default (keep every
  finished job forever, payload JSON included) applied to nearly every job
  type. Added bounded retention via each file's shared `defaultJobOptions`.
- **`workers:known` never expiring dead entries.** By design, so a status
  page can show "offline" workers — fine at current fleet size but unbounded
  growth over time for any worker identity that never comes back. Added
  `pruneStaleWorkers()` in `apps/worker/src/lib/worker-registry.ts`, run on
  a 6h interval from `apps/worker/src/index.ts`, reaping entries stale past
  90 days. `apps/api/src/routes/admin/workers.ts` updated for the same
  staleness notion.

## Why

Production Redis memory growth with no ceiling and no eviction — first two
items directly cause unbounded growth; the third is a smaller, slower leak
in the same area, fixed alongside since it touches the same worker-registry
code path.

## Status when picked back up (2026-09-14)

Single commit already contained the full implementation. Verified before
push:

- `pnpm format` — clean, no changes.
- `pnpm exec eslint` on all changed source files — clean.
- `tsc --noEmit` via `pnpm --filter @tahti/api run typecheck` and
  `apps/worker`'s `typecheck` script — both clean.
- `pnpm --filter @tahti/api-client generate` — regenerates `schema.d.ts`
  cleanly (`apps/api` changed, so this was required per the repo workflow).

## Leftovers / not done

- No automated test added for `pruneStaleWorkers()` or the retention
  options — worth a unit test on the 90-day cutoff logic if this gets
  revisited.
- Not yet pushed / no PR opened.
