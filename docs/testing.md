# Testing (API / monorepo)

## Prerequisites

```bash
docker compose -f infra/docker-compose.dev.yml up postgres redis -d
pnpm install --frozen-lockfile
pnpm --filter @tahti/db db:generate
```

## Commands

- `pnpm ci:check` — lint, format, typecheck
- `pnpm test` — Vitest (single worker; shared Postgres)
- `pnpm test:e2e:journeys` — bash persona journeys (listener, artist, member, director, ops)
- `pnpm test:e2e:journeys:all` — vital-flows + user-journeys + Vitest `persona-journeys.test.ts`

## Test data isolation

- Prefer `cleanupUsersByEmailPrefix(prisma, 'my-prefix-')` for artist fixtures.
- Use `allocateMemberNumber(prisma)` instead of hard-coded `memberNumber` bands (PLAT-012).
- Vitest: `maxWorkers: 1` in root `vitest.config.ts` until Testcontainers lands.
- CI applies schema with `db push`; `prisma migrate status` runs only after `prisma/migrations` exists.
