# Squash Prisma migrations into one baseline

Status: ready to merge, prod reconciliation step still open

## What this is

Replaced all 149 migrations under `packages/db/prisma/migrations/` with a
single baseline `20260911000000_init`, since the project is still in dev
phase and doesn't need per-change migration history.

## How it was generated / verified

- `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
  — pure schema diff, no live DB needed to generate.
- Applied the result to a throwaway `postgres:16-alpine` container, then
  diffed that DB against `schema.prisma` again — result was `-- This is an
  empty migration.`, confirming zero drift (the squash is lossless).
- Separately confirmed the *old* migration history was never runnable
  against a truly empty database either (`prisma migrate deploy` from
  scratch fails on migration 1 with `schema "channel" does not exist` —
  the schemas were assumed pre-existing). `scripts/dev-setup.sh` already
  works around this with a `prisma migrate dev` fallback. The new baseline
  fixes this: a fresh `pnpm --filter @tahti/db db:migrate` now succeeds
  from empty without the fallback.

## Open follow-up: production reconciliation

Production's `_prisma_migrations` table already has all 149 old migrations
recorded. Before the next `prisma migrate deploy` runs there (i.e. before/at
the next production deploy), someone with prod DB access must run, once:

```
DATABASE_URL='<production DATABASE_URL>' \
  pnpm --filter @tahti/db exec prisma migrate resolve --applied 20260911000000_init
```

This only records the migration as applied — it does not run any SQL — so
it's safe given production's schema already matches `schema.prisma` (same
thing the squashed migration produces). Skipping this step would make the
next `prisma migrate deploy` try to actually run the baseline SQL against a
database that already has those tables/schemas, and fail.

The old 149 rows already in production's `_prisma_migrations` table are
harmless leftover history and don't need cleanup.
