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

### UI component reuse

When creating a new view, always use an applicable existing Storybook/
`@tahti/ui` component. Add a new component to the shared UI kit and its
Storybook coverage when no suitable component exists; do not introduce a
one-off view primitive in `apps/web`.

Before running `pnpm ci:check`, always run `pnpm format` (or the narrower
Prettier command for the files changed) and then confirm with
`pnpm format:check`.

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
| Tahti Radio Discord bot    | Sibling `../tahti-radio-discord-bot` — Compose service `radio-discord-bot`, not the Fastify API          |

## Tahti Player import-plugin boundary

The Tahti Player client/plugin repository is the sibling checkout at
`../tahti-player`. Features that extend Tahti Player’s import-plugin system belong
there, not in Tahti core. Keep Tahti responsible for its API, worker jobs, and
server-side persistence; the Tahti Player plugin owns its client configuration flow.

The versioned import-provider catalog is `GET /api/me/import-plugins`
(`docs/technical/import-plugin-contracts.md`). Keep OAuth, search, and
tool/upload kinds separate. Export/DSP delivery uses a separate catalog:
`GET /api/me/export-plugins` (`docs/technical/export-plugin-contracts.md`)
with submit/status/webhook paths (Revelator live; other DSPs may be stubs).

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

### Official marketplace catalog (`tahti-registry`)

What users see in Tahti Player’s plugin/theme **Store** is **not** this
monorepo and not the player’s on-disk install list. The catalog is
[github.com/janiluuk/tahti-registry](https://github.com/janiluuk/tahti-registry)
(`plugins.json`, `themes/`, generated `themes.json`), fetched by the player from
`https://raw.githubusercontent.com/janiluuk/tahti-registry/master`.

Sibling checkouts (same parent as this repo): `../tahti-registry` (catalog),
`../tahti-player` or `../tahti-nuclear` (player + beta web),
`../tahti-radio-discord-bot` (Tahti Radio Discord bot). `GET
/api/me/import-plugins` is the **API** import-provider list; it does not
replace the Store catalog.

After any plugin add or change that has (or should have) a Store listing:

1. Open `../tahti-registry` and inspect `plugins.json` (themes under `themes/`).
2. **Added** — add a catalog row. Users must see the plugin in that repo.
3. **Changed** — bump the plugin `package.json` version **and** the matching
   catalog `version` / `downloadUrl` (player auto-update uses those fields).
4. Run `pnpm validate` / `pnpm check-plugins` in `tahti-registry`.
5. Do not finish with a store plugin that exists only in player or API code.

### Plugin registry extraction guardrail

Begin separating the plugin registry as an independently owned boundary, but do
not break or migrate the current registry yet. First inventory its callers and
persisted `plugins.json` format, define a small compatibility interface, and add
contract tests for install, enable/disable, warnings, updates, and removal.
The existing registry remains the runtime source of truth until the adapter,
rollback path, and player-app contract are accepted. Do not change registry
keys, bootstrap ordering, plugin discovery semantics, or storage location while
doing this preparation.

## Tahti Radio Discord bot

The 24/7 Discord voice bot lives in the sibling repo
[`../tahti-radio-discord-bot`](https://github.com/janiluuk/tahti-radio-discord-bot).
It is a long-running Gateway process (Serenity + ffmpeg + yt-dlp), **not** an
HTTP service. Do not fold it into Fastify. Do not give it a Discord Interactions
Endpoint URL. Do not deploy it to Fly.io.

Stack wiring:

- Compose service `radio-discord-bot` in `infra/docker-compose.stack.yml` (one
  replica — a second copy joins Discord twice and plays in duplicate).
- Build context defaults to sibling `../../tahti-radio-discord-bot` (relative to
  `infra/`). Override with `RADIO_DISCORD_BOT_CONTEXT` or `RADIO_DISCORD_BOT_SRC`.
- `./scripts/deploy_prod.sh` **requires** that checkout: it rsyncs it to
  `$DEPLOY_PATH/../tahti-radio-discord-bot` (default `/srv/tahti-radio-discord-bot`)
  and builds the service with api / web / worker / orchestrator.
- `./scripts/stack-up.sh` starts the bot when the sibling (or
  `RADIO_DISCORD_BOT_SRC`) exists; otherwise it skips the service.
- Helper: `./scripts/radio-discord-bot-src.sh`.

Credentials: the bot calls `GET /api/v1/internal/discord-bot/credentials` with
`INTERNAL_SECRET` (`TAHTI_API_BASE=http://api:3001` on the compose network).
Board admins set Client ID and token in Tahti Player → Settings → Add-ons →
Radio (`PUT /api/admin/discord-bot`; never returns the raw token). Optional
`DISCORD_CLIENT_ID` / `DISCORD_TOKEN` on the API or bot are env fallbacks.
Contract: `docs/technical/discord-bot-credentials.md`.

## Running the app locally (env gotchas)

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

Demo/e2e seed accounts (see `tests/e2e/journeys/fixtures.sh`): board account is
`screenshot-board@e2e.tahti.live` — only present after seeding
(`./scripts/stack-up.sh --seed` or the individual `apps/api/scripts/seed-*.ts`
scripts), password `screenshot-demo-pass`.

**Naming:** `beta.tahti.live` is the Nuclear listen/studio SPA (production API).
`[BETA]` / `*@beta.tahti.live` in seed scripts are **dev fixtures only**.

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
| Discord bot credentials       | `docs/technical/discord-bot-credentials.md`      |
| Grants + fan-subs             | `docs/engagement-and-fansubs.md`                 |
| Infra / no CDN                | `docs/infra-strategy.md`                         |
| Design                        | `docs/design/README.md`, `docs/e2e-screenshots/` |
| User journeys                 | `docs/user-flows.md`, `docs/guides/`             |

## Anti-patterns (short list)

Full list in `docs/AGENT.md`. Never: enforce storage quotas as product limits;
algorithmic feeds / follow graphs; mutate ledger entries; YouTube/Twitch for
Tahti Radio; edit `website/` unasked; put UI components in `apps/web` instead of
`@tahti/ui`.
