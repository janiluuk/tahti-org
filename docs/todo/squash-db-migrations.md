# Squash Prisma migrations into one baseline

Status: ready to merge, no prod action required

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

## Production reconciliation: not needed

Checked directly on vimage (`docker compose -f infra/docker-compose.stack.yml
exec postgres psql ...`): `_prisma_migrations` does have 132 old rows there
(last one from 2026-09-04), but the stack's actual deploy mechanism — the
`db-push` service in `infra/docker-compose.stack.yml` — runs `prisma db push
--accept-data-loss` on every `docker compose up`, which diffs the live DB
directly against `schema.prisma` and never reads `_prisma_migrations` at all.
That's why the table stopped tracking new migrations after 2026-09-04 even
though 17 more were added after that date — `db push` doesn't write to it
either.

So squashing has zero effect on this deploy path: after this PR ships,
`db-push` re-runs, finds the DB already matches `schema.prisma` (verified
above), and no-ops. The stale `_prisma_migrations` rows are harmless and
don't need cleanup.

(`ops/DEPLOY.md` describes a separate Swarm-based flow that does use `prisma
migrate deploy` / `db:migrate` — if that pipeline is ever pointed at this
same database, it — not this squash — would be the thing to check for
`_prisma_migrations` compatibility first.)
