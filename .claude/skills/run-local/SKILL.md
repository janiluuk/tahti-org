---
name: run-local
description: Run Tahti locally — full Docker stack via ./scripts/stack-up.sh --seed, or apps/api directly with pnpm dev — including the env gotchas (API entrypoint, DATABASE_URL), the tahti-player SPA overlay, and the demo/e2e seed accounts. Use when starting, running, screenshotting or logging into the app locally.
---

# Running the app locally (env gotchas)

**Use `./scripts/stack-up.sh --seed` first** — it builds and runs the full
Docker stack (postgres, pgbouncer, redis, minio, mailhog, chat, icecast,
rtmp-ingest, api, worker, orchestrator, and `radio-discord-bot` when
`../tahti-radio-discord-bot` is present) with demo fixtures loaded. API at
`http://localhost:${API_PORT:-15011}`. The stack has no web UI of its own: the
app is the tahti-player SPA. Build it in `../tahti-player`
(`pnpm --filter @tahti-player/tahti-web build`) and start the overlay in
`infra/docker-compose.tahti-web.yml` (app at
`http://localhost:${TAHTI_WEB_PORT:-17778}`), or run the SPA's own Vite dev
server against this API. `./scripts/stack-up.sh --down` tears it down; ports
are all `15000+` so they don't collide with an ad-hoc dev server.

If you instead run `apps/api` directly with `pnpm dev` (e.g. to iterate with
hot reload), two things bite:

- **API entrypoint is `src/index.ts`, not `src/server.ts`.** `server.ts` only
  exports `buildApp()` (used by tests); it never calls `.listen()`. Running it
  directly binds nothing and every request looks like a hang.
- **`DATABASE_URL` has no default outside Vitest.** The dev Postgres container
  publishes on host port `5432` (`infra/docker-compose.dev.yml`), so:
  `DATABASE_URL=postgresql://tahti:tahti_dev@localhost:5432/tahti`. Don't guess
  a different port from `docker inspect` — in some sandboxes it reports empty
  `Ports`/`Networks` even when the mapping is real; verify with a raw TCP probe
  (`(exec 3<>/dev/tcp/127.0.0.1/5432)`) or by pointing a client at it directly.

Demo/e2e seed accounts (see `tests/e2e/journeys-fixtures.sh`): board account is
`screenshot-board@e2e.tahti.live` — only present after seeding
(`./scripts/stack-up.sh --seed` or the individual `apps/api/scripts/seed-*.ts`
scripts), password `screenshot-demo-pass`.
