# Agent instructions — Tahti

Cursor / coding agents: start here. Deep product and milestone specs live in
linked docs; do not invent product rules that contradict them.

## Read first (order matters)

1. **[`docs/CONSTITUTION.md`](docs/CONSTITUTION.md)** — three non-negotiable rules.
2. **[`docs/AGENT.md`](docs/AGENT.md)** — coding brief: stack, milestones, data model, anti-patterns.
3. **[`docs/remaining-work.md`](docs/remaining-work.md)** — collective incomplete checklist (legal, ops, engineering).
4. **[`docs/project-roadmap.md`](docs/project-roadmap.md)** — build audit + phase status (source of truth for `[x]` / `[~]` / `[ ]`).
5. **[`docs/features.md`](docs/features.md)** — what is implemented today on the product surface.
6. **[`docs/testing.md`](docs/testing.md)** — how to run Vitest, smoke, and journey e2e.

## Always-on Cursor rules

| Rule                                 | Path                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| Lint/format before done              | [`.cursor/rules/ci-lint-before-done.mdc`](.cursor/rules/ci-lint-before-done.mdc) |
| UI only via `@tahti/ui`              | [`.cursor/rules/ui-library.mdc`](.cursor/rules/ui-library.mdc)                   |
| Do not touch `website/` unless asked | [`.cursor/rules/website-off-limits.mdc`](.cursor/rules/website-off-limits.mdc)   |
| Project map + remaining work         | [`.cursor/rules/project-context.mdc`](.cursor/rules/project-context.mdc)         |

## What this monorepo is

Nonprofit AGPL broadcasting platform (Tahti ry). Artists get always-on channels
(live HLS → archive fallback), studio tools, fan-subs, grants from engagement
units. Listeners stay anonymous by default.

| Surface                    | Location                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| API / workers / studio web | `apps/api`, `apps/worker`, `apps/web`                                                                    |
| UI kit                     | `packages/ui` (`@tahti/ui`) — never duplicate in `apps/web`                                              |
| Marketing site             | `website/` — **off limits** unless user explicitly asks                                                  |
| Tahti Player beta client   | Separate repo; cutover in [`ops/nuclear-web-cutover.md`](ops/nuclear-web-cutover.md) (`beta.tahti.live`) |

## Tahti Player import-plugin boundary

The Tahti Player client/plugin repository is the sibling checkout at
`../tahti-player`. Features that extend Tahti Player’s import-plugin system belong
there, not in Tahti core. Keep Tahti responsible for its API, worker jobs, and
server-side persistence; the Tahti Player plugin owns its client configuration flow.

For import plugins, all provider configuration must happen from the plugin’s
Configure action in a modal. The modal must support entering keys/settings,
testing the connection, and only then saving/enabling the plugin. Do not add a
second configuration surface in Tahti core or silently enable an unverified
provider.

Still to clarify before extending the plugin API: whether Configure is a
first-class SDK lifecycle hook or a host-rendered settings modal; the exact
connection-test contract and error states; and whether Save and Enable are one
atomic action or separate actions. Record the decision in both repositories’
agent instructions when settled.

### Plugin registry extraction guardrail

Begin separating the plugin registry as an independently owned boundary, but do
not break or migrate the current registry yet. First inventory its callers and
persisted `plugins.json` format, define a small compatibility interface, and add
contract tests for install, enable/disable, warnings, updates, and removal.
The existing registry remains the runtime source of truth until the adapter,
rollback path, and player-app contract are accepted. Do not change registry
keys, bootstrap ordering, plugin discovery semantics, or storage location while
doing this preparation.

## Running the app locally (env gotchas)

**Use `./scripts/stack-up.sh --seed` first** — it builds and runs the full
Docker stack (postgres, pgbouncer, redis, minio, mailhog, chat, icecast,
rtmp-ingest, api, worker, orchestrator, web) with demo fixtures loaded. App at
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

Demo/e2e seed accounts (see `tests/e2e/journeys/fixtures.sh`): board account is
`screenshot-board@e2e.tahti.live` — only present after seeding
(`./scripts/stack-up.sh --seed` or the individual `apps/api/scripts/seed-*.ts`
scripts), password `screenshot-demo-pass`.

## Quality gates (before claiming done)

```bash
pnpm ci:check   # lint + format + typecheck (+ Tor list freshness)
pnpm test       # Vitest — needs Postgres (+ Redis); see docs/testing.md
```

Prefer `pnpm ci:check` after TypeScript changes. Fix Prettier with `pnpm format`.

## Doc map (quick)

| Need                          | Doc                                              |
| ----------------------------- | ------------------------------------------------ |
| Mission / money / AGPL        | `docs/about.md`, `docs/CONSTITUTION.md`          |
| Milestone specs               | `docs/AGENT.md`                                  |
| Incomplete work (all owners)  | `docs/remaining-work.md`                         |
| Status matrix                 | `docs/project-roadmap.md`                        |
| Deferred / efficiency backlog | `docs/future-improvements.md`                    |
| Streaming scale rules         | `docs/technical/streaming-architecture.md`       |
| Grants + fan-subs             | `docs/engagement-and-fansubs.md`                 |
| Infra / no CDN                | `docs/infra-strategy.md`                         |
| Design                        | `docs/design/README.md`, `docs/e2e-screenshots/` |
| User journeys                 | `docs/user-flows.md`, `docs/guides/`             |

## Anti-patterns (short list)

Full list in `docs/AGENT.md`. Never: enforce storage quotas as product limits;
algorithmic feeds / follow graphs; mutate ledger entries; YouTube/Twitch for
Tahti Radio; edit `website/` unasked; put UI components in `apps/web` instead of
`@tahti/ui`.
