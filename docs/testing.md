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
- `pnpm --filter @tahti/api test -- path/to/file.test.ts` — one package / file

## Test data isolation

- Prefer `cleanupUsersByEmailPrefix(prisma, 'my-prefix-')` for artist fixtures.
- Use `allocateMemberNumber(prisma)` instead of hard-coded `memberNumber` bands (PLAT-012).
- Vitest: `maxWorkers: 1` in root `vitest.config.ts` until Testcontainers lands.
