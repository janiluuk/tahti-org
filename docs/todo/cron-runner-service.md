# Cron-runner service + admin cron run log

Status: **open** (implemented, tests green, not yet pushed/PR'd)

## What this is

Splits BullMQ repeatable-cron registration out of every worker replica into a
single dedicated `cron-runner` stack service (`apps/worker/src/cron-runner.ts`
+ `apps/worker/src/lib/cron-scheduler.ts`), so replicas only execute jobs and
never race to delete/recreate the repeatable-job manifest. Bundles in a
second, unrelated-but-adjacent change: Liquidsoap templates now log which
sound-fallback context (`archive_source_context`) is in play when the live
input isn't available, for STREAM-009 observability.

Each `CronRun` now also stores a bounded JSON `resultJson` of the handler's
return value (`apps/worker/src/lib/cron-run.ts`, truncated past 16,000 chars),
surfaced end-to-end via a new `GET /api/admin/stats/cron-runs/history`
endpoint and `/admin/crons` admin page (paginated, filterable by job name).

## Why

Confirmed incident (see the comment removed from `index.ts`): two
`hls-minio-sync` repeat hashes were both enqueuing, doubling MinIO load and
causing ~40s sync gaps. Multiple worker replicas each independently wiping
and re-registering the manifest on startup was the root cause; one owning
service removes the race.

## Status when picked back up (2026-09-12)

Found sitting uncommitted, directly in the main checkout on the unrelated
`ops/docker-disk-cleanup-schedule` branch — moved into this worktree/branch
per the repo's worktree-for-features rule. Fixed to get it actually working:

- Prisma client was stale after the `resultJson` column was added to
  `schema.prisma` — regenerated (`pnpm --filter @tahti/db db:generate`).
- Dead `defaultJobOptions` left in `apps/worker/src/index.ts` after
  registration moved to `cron-scheduler.ts` — removed (eslint error).
- **Blocking bug:** `AdminCronRunHistoryResponseSchema`'s `page`/`limit` used
  `z.number().int().positive()`, which zod-to-json-schema serializes as a
  boolean-style `exclusiveMinimum: true` — this crashes Fastify's ajv schema
  compiler at boot (`FST_ERR_SCH_SERIALIZATION_BUILD`), which would have
  taken down the *entire* API on deploy. Same issue is already documented
  and worked around three lines above in the same file
  (`AdminChatTimeseriesSchema.days`); the new schema didn't follow it.
  Fixed by switching to `.min(1)`.

All of `tsc --noEmit` / eslint / the relevant vitest suites / `pnpm
--filter @tahti/api-client generate` / `pnpm format:check` pass clean after
the fixes.

## Leftovers / not done

- No test added for the new `GET /api/admin/stats/cron-runs/history` route
  in `apps/api/src/routes/admin/stats.test.ts` — that file is e2e-style and
  needs a live Postgres, which isn't available in this environment to verify
  against. Existing coverage there is already partial (not every admin stats
  route has a test), so this isn't a regression, but it's worth adding.
- Not yet pushed / no PR opened.
