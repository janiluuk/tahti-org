# Testing (API / monorepo)

## Prerequisites

**Node.js 24+** (see root `.nvmrc` / `.node-version`). With nvm: `nvm install && nvm use`.

```bash
docker compose -f infra/docker-compose.dev.yml up postgres redis -d
pnpm install --frozen-lockfile
pnpm --filter @tahti/db db:generate
```

For full stack + journey fixtures: `./scripts/stack-up.sh --seed` (API `:15011`, web `:17777`).

## Commands

| Command | What it runs |
|---------|----------------|
| `pnpm ci:check` | Lint, format, typecheck, Tor exit list freshness |
| `pnpm test` | Vitest (single worker; needs Postgres) |
| `pnpm smoke` | Local CI gate + stack health (`scripts/unified-smoke.sh`) |
| `pnpm smoke:prod` | Above + production HTTP checks on `app.tahti.live` |
| `pnpm smoke:all` | Prod + e2e bash journeys (stack must be up; `--seed` fixtures) |
| `pnpm test:e2e:journeys:all` | Vital-flows + user-journeys + Vitest `persona-journeys.test.ts` |

Other scripts: `pnpm tor-exit:check`, `./scripts/status-monitor.sh`, persona-specific `pnpm test:e2e:journeys:*`.

**Journey map** (routes, APIs, scripts): [`user-flows.md`](user-flows.md).

### Vitest journey suites

Under `apps/api/src/routes/journeys/`:

- `persona-journeys.test.ts` — listener, artist studio, member governance, director admin, ops health
- `vital-flows.test.ts` — onboarding, fan subs, catalog gates, live broadcast, governance vote
- `public-surfaces-journey.test.ts` — home/discover stats + channels, radio, venues, status
- `tahti-radio-journey.test.ts` — Tahti Radio channel, chat tokens, announcements, member relay

### Smoke script flags

```bash
./scripts/unified-smoke.sh              # Phase 0–1 (ci:check + local stack)
./scripts/unified-smoke.sh --prod       # + production HTTP checks
./scripts/unified-smoke.sh --e2e        # + vital-flows.sh + user-journeys.sh
./scripts/unified-smoke.sh --all --seed # prod + e2e with fixture seed
```

## Test data isolation

- Prefer `cleanupUsersByEmailPrefix(prisma, 'my-prefix-')` for artist fixtures.
- Use `allocateMemberNumber(prisma)` instead of hard-coded `memberNumber` bands (PLAT-012).
- Vitest: `maxWorkers: 1` in root `vitest.config.ts` until Testcontainers lands.
- CI applies schema with `db push`, then baselines `_prisma_migrations` via `migrate resolve --applied` when `prisma/migrations/` exists; deploy uses `migrate deploy`.

## Failure triage

| Symptom | Likely fix |
|---------|------------|
| API exits on start | Check API Dockerfile includes all workspace packages (e.g. `@tahti/revelator`) |
| Chat 404 on `/radio` | Run `apps/api/scripts/seed-tahti-radio.ts` or `./scripts/stack-up.sh --seed` |
| Vitest DB errors | Start Postgres or full stack; run `DATABASE_URL=... pnpm --filter @tahti/db db:migrate:test` |
| `/radio` old UI on prod | Rebuild `web` service; app is at `app.tahti.live`, not `tahti.live` |
| Chat join E2E fails | Viewer token must not skip join UI; rebuild web after `chat-panel.tsx` changes |
| Signup form vs beta closed | Set `SIGNUP_OPEN=true` in stack env |
