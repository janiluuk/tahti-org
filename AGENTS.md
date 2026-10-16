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
| Done todos → HISTORY.md              | [`.cursor/rules/todo-history.mdc`](.cursor/rules/todo-history.mdc)               |
| Stack PRs; defer catalog edits       | [`.cursor/rules/pr-stacking.mdc`](.cursor/rules/pr-stacking.mdc)                 |

### UI component reuse

When creating a new view, always use an applicable existing Storybook/
`@tahti/ui` component. Add a new component to the shared UI kit and its
Storybook coverage when no suitable component exists; do not introduce a
one-off view primitive in `apps/web`.

Before running `pnpm ci:check`, always run `pnpm format` (or the narrower
Prettier command for the files changed) and then confirm with
`pnpm format:check`. Always run Prettier format on the files you changed
before pushing.

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

**Configure lifecycle (settled 2026-10-05):** host-rendered settings modal in
Tahti Player (not an SDK lifecycle hook). Connection test returns
`{ ok: true } | { ok: false, error: string }` and blocks Save on failure when
`connectionTest` is advertised. **Save** and **Enable** are separate actions —
Save persists credentials/settings; Enable turns the provider on only after a
successful test (or after Save when the catalog has no connection test). Same
decision recorded in `../tahti-player/docs/DECISIONS.md`.

### Official marketplace catalog (`tahti-registry`)

What users see in Tahti Player’s plugin/theme **Store** is **not** this
monorepo and not the player’s on-disk install list. The catalog is
[github.com/janiluuk/tahti-registry](https://github.com/janiluuk/tahti-registry)
(`plugins.json`, `themes/`, generated `themes.json`), fetched by the player from
`https://raw.githubusercontent.com/janiluuk/tahti-registry/master`.

Sibling checkouts (same parent as this repo): `../tahti-registry` (catalog),
`../tahti-player` (player + beta web),
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

### Plugin runtime registry

The desktop runtime registry (installed plugins, `plugins.json` in AppData) is
`@tahti-player/plugin-registry`, in its own repo
([janiluuk/tahti-plugin-registry](https://github.com/janiluuk/tahti-plugin-registry))
and pinned by tag in `../tahti-player`; ownership
split and rollback plan: `../tahti-player/docs/PLUGIN-REGISTRY.md`. Do not
change registry keys, bootstrap ordering, plugin discovery semantics, or
storage location without a migration plan. Cross-repo API honesty work:
`docs/todo/api-player-gap-mapping.md`.

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

Playback: default is curated YouTube URLs in the bot’s `tracks.txt` (yt-dlp).
`GET /api/v1/radio` is **now-playing metadata only**, not audio. To play the
live Tahti Radio HLS feed, set `TAHTI_RADIO_AUDIO_URL` on the
`radio-discord-bot` service (same env as the web/API radio audio override).

## Running the app locally (env gotchas)

Start with `./scripts/stack-up.sh --seed` (full Docker stack + demo fixtures;
`--down` tears it down). Before running `apps/api` / `apps/web` directly with
`pnpm dev`, or when you need the seed accounts, read
[`.claude/skills/run-local/SKILL.md`](.claude/skills/run-local/SKILL.md) —
entrypoint, `DATABASE_URL`, and `NEXT_PUBLIC_API_BASE` gotchas live there.

**Naming:** `beta.tahti.live` is the Tahti Player listen/studio SPA (production API).
`[BETA]` / `*@beta.tahti.live` in seed scripts are **dev fixtures only**.

## Quality gates (before claiming done)

```bash
pnpm ci:check   # lint + format + typecheck (+ Tor list freshness)
pnpm test       # Vitest — needs Postgres (+ Redis); see docs/testing.md
```

Prefer `pnpm ci:check` after TypeScript changes. Fix Prettier with `pnpm format`.

## Doc map (quick)

| Need                          | Doc                                                  |
| ----------------------------- | ---------------------------------------------------- |
| Mission / money / AGPL        | `docs/about.md`, `docs/CONSTITUTION.md`              |
| Milestone specs               | `docs/AGENT.md`                                      |
| Incomplete work (all owners)  | `docs/remaining-work.md`                             |
| Active todos (open only)      | `docs/todo/` — shipped work → `docs/todo/HISTORY.md` |
| Status matrix                 | `docs/project-roadmap.md`                            |
| Deferred / efficiency backlog | `docs/future-improvements.md`                        |
| Streaming scale rules         | `docs/technical/streaming-architecture.md`           |
| Discord bot credentials       | `docs/technical/discord-bot-credentials.md`          |
| Grants + fan-subs             | `docs/engagement-and-fansubs.md`                     |
| Infra / no CDN                | `docs/infra-strategy.md`                             |
| Design                        | `docs/design/README.md`, `docs/e2e-screenshots/`     |
| User journeys                 | `docs/user-flows.md`, `docs/guides/`                 |

## Anti-patterns (short list)

Full list in `docs/AGENT.md`. Never: enforce storage quotas as product limits;
algorithmic feeds / follow graphs; mutate ledger entries; YouTube/Twitch for
Tahti Radio; edit `website/` unasked; put UI components in `apps/web` instead of
`@tahti/ui`; rewrite `remaining-work.md` / `features.md` / `HISTORY.md` on every
intermediate PR commit (stack related PRs; fold catalogs when ready to merge).
