# Testing (API / monorepo)

## Prerequisites

```bash
docker compose -f infra/docker-compose.dev.yml up postgres redis -d
pnpm install --frozen-lockfile
pnpm --filter @tahti/db db:generate
```

## Commands

- `pnpm ci:check` — lint, format, typecheck, bundled Tor exit list freshness
- `pnpm tor-exit:check` — M18 bundled list not empty/stale (max 30 days)
- `pnpm tor-exit:sync` — refresh bundled Tor exits from Tor Project bulk list
- `./scripts/status-monitor.sh` — M11 probe `/api/v1/status`, `/health`, web home (Upptime substitute)
- `pnpm test` — Vitest (single worker; shared Postgres)
- `pnpm test:e2e:journeys` — bash persona journeys (listener, artist, member, director, ops)
- `pnpm test:e2e:journeys:all` — vital-flows + user-journeys + Vitest `persona-journeys.test.ts`
- `./scripts/unified-smoke.sh` — phased smoke from [`unified-test-plan.md`](unified-test-plan.md) (CI + local stack; `--prod`, `--e2e`, `--all`)

## Test data isolation

- Prefer `cleanupUsersByEmailPrefix(prisma, 'my-prefix-')` for artist fixtures.
- Use `allocateMemberNumber(prisma)` instead of hard-coded `memberNumber` bands (PLAT-012).
- Vitest: `maxWorkers: 1` in root `vitest.config.ts` until Testcontainers lands.
- CI applies schema with `db push`, then baselines `_prisma_migrations` via `migrate resolve --applied` when `prisma/migrations/` exists; deploy uses `migrate deploy`.
