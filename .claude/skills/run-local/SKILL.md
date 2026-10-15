---
name: run-local
description: Run Tahti locally — full Docker stack via ./scripts/stack-up.sh --seed, or apps/api + apps/web directly with pnpm dev — including the env gotchas (API entrypoint, DATABASE_URL, NEXT_PUBLIC_API_BASE) and the demo/e2e seed accounts. Use when starting, running, screenshotting or logging into the app locally.
---

# Running the app locally (env gotchas)

**Use `./scripts/stack-up.sh --seed` first** — it builds and runs the full
Docker stack (postgres, pgbouncer, redis, minio, mailhog, chat, icecast,
rtmp-ingest, api, worker, orchestrator, web, and `radio-discord-bot` when
`../tahti-radio-discord-bot` is present) with demo fixtures loaded. App at
`http://localhost:${WEB_PORT:-17777}`, API at `http://localhost:${API_PORT:-15011}`.
This is also what the screenshot-capture and e2e-journey scripts assume.
`./scripts/stack-up.sh --down` tears it down; ports are all `15000+` so they
don't collide with an ad-hoc dev server.

If you instead run `apps/api` and `apps/web` directly with `pnpm dev` (e.g. to
iterate on one package with hot reload), three things bite:

- **API entrypoint is `src/index.ts`, not `src/server.ts`.** `server.ts` only
  exports `buildApp()` (used by tests); it never calls `.listen()`. Running it
  directly binds nothing and every request looks like a hang.
- **`DATABASE_URL` has no default outside Vitest.** The dev Postgres container
  publishes on host port `5432` (`infra/docker-compose.dev.yml`), so:
  `DATABASE_URL=postgresql://tahti:tahti_dev@localhost:5432/tahti`. Don't guess
  a different port from `docker inspect` — in some sandboxes it reports empty
  `Ports`/`Networks` even when the mapping is real; verify with a raw TCP probe
  (`(exec 3<>/dev/tcp/127.0.0.1/5432)`) or by pointing a client at it directly.
- **`apps/web` client components fetch the API cross-origin, not via a
  same-origin proxy.** In production, `app.tahti.live` and `api.tahti.live` are
  two different Caddy origins (see `infra/Caddyfile`) — there is no Next.js
  rewrite for `/api/*`. Every `'use client'` component that calls the API
  builds its base URL from the `NEXT_PUBLIC_API_BASE` env var (falling back to
  `http://localhost:3001`) and passes `credentials: 'include'`; a relative
  `fetch('/api/...')` 404s against the Next.js app itself. Locally this means
  starting `apps/web` with `NEXT_PUBLIC_API_BASE` set to the API's origin
  (baked in at `next dev`/`next build` time, not readable at runtime). The
  API's CORS plugin (`apps/api/src/plugins/cors.ts`) already allows any
  `localhost`/`127.0.0.1` origin outside prod, so credentialed cross-origin
  requests just work once the env var is set.

Demo/e2e seed accounts (see `tests/e2e/journeys-fixtures.sh`): board account is
`screenshot-board@e2e.tahti.live` — only present after seeding
(`./scripts/stack-up.sh --seed` or the individual `apps/api/scripts/seed-*.ts`
scripts), password `screenshot-demo-pass`.
