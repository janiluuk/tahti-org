# Tahti Radio Discord bot — API contracts

Board admins configure the Discord application Client ID and bot token from
Tahti Player → Settings → Add-ons → Tools. The bot process loads the same
values over an internal endpoint so redeploys pick up admin saves without
baking secrets into the bot image.

These routes are **not** in the public OpenAPI document (`/api/openapi.json`).
They appear in the authenticated full reference (`GET /docs`) and in the
generated client under `packages/api-client`.

## Schemas (`@tahti/shared`)

| Schema                            | Role                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AdminDiscordBotSettings`          | Board-facing view: `clientId`, `tokenConfigured`, `tokenHint` (last four), `source` (`database` \| `env` \| `none`) |
| `UpdateDiscordBotSettings`         | Board PUT body: `clientId` (17–20 digit snowflake), optional `token` (min 20 chars)                                 |
| `InternalDiscordBotCredentials`    | Bot fetch: plaintext `clientId` + `token`                                                                           |
| `DiscordBotHeartbeat`              | Bot → API liveness ping: `guildCount`, `uptimeSecs`, `currentTrack?`                                                |
| `DiscordBotHeartbeatAck`           | `{ ok: true }`                                                                                                       |
| `AdminDiscordBotRestartResponse`   | `{ ok: true, action: 'restart', container }`                                                                        |

The raw token is never returned on board routes. `tokenHint` is `••••` + last four
characters when a token is configured.

## Board (session cookie, `requireBoard`)

### `GET /api/admin/discord-bot`

Returns `AdminDiscordBotSettings`. Resolution order for the live credentials:

1. `admin.DiscordBotSettings` row (`id = default`) if present
2. Else env `DISCORD_CLIENT_ID` + `DISCORD_TOKEN` on the API process
3. Else `source: "none"` with empty `clientId` and `tokenConfigured: false`

### `PUT /api/admin/discord-bot`

Body: `{ "clientId": "<snowflake>", "token"?: "<bot token>" }`.

- First save requires `token`.
- Later saves may omit `token` to keep the encrypted value already stored.
- Token is AES-GCM encrypted at rest (`tokenEnc`, same key material as stream keys).
- Response is the updated `AdminDiscordBotSettings` with `source: "database"`.

Errors: `400` validation / `TOKEN_REQUIRED`; `401`/`403` when not board.

### `POST /api/admin/discord-bot/restart`

Restarts the `radio-discord-bot` container via the orchestrator (finds it by
its `com.docker.compose.service=radio-discord-bot` label and runs
`docker restart`) — useful after saving new credentials, since the bot only
reads them at startup. Returns `AdminDiscordBotRestartResponse`. Audit-logged
as `DISCORD_BOT_RESTART`.

Errors: `409` when the container isn't currently running; `502` when the
orchestrator is unreachable.

## Internal (Bearer `INTERNAL_SECRET`)

### `GET /api/v1/internal/discord-bot/credentials`

Returns `{ "clientId", "token" }` for the Discord bot process only.

- `401` when `Authorization` is not `Bearer <INTERNAL_SECRET>`
- `404` when neither database nor env credentials are available

Bot env: `TAHTI_API_BASE` + `INTERNAL_SECRET` (see
[tahti-radio-discord-bot](https://github.com/janiluuk/tahti-radio-discord-bot)).

The bot process is the `radio-discord-bot` service in
`infra/docker-compose.stack.yml`. `./scripts/deploy_prod.sh` rsyncs the sibling
repo and builds it with the rest of the stack. One replica only.

### `POST /api/v1/internal/discord-bot/heartbeat`

Body: `DiscordBotHeartbeat` (`guildCount`, `uptimeSecs`, `currentTrack?`).
The bot self-reports on a 20s interval (there's no inbound port to poll
instead — a pure outbound Discord gateway client). Stored in Redis
(`discord-bot:heartbeat`, no TTL — a bot that stops heartbeating stays
visible as stale rather than disappearing). No guild IDs/names, no secrets.

Returns `DiscordBotHeartbeatAck`. `401` when the Bearer secret is wrong.

## Monitoring

The heartbeat feeds a `discord-bot` entry into `runDependencyChecks()`
(`apps/api/src/lib/health-checks.ts`), non-critical, "down" once the last
heartbeat is older than `ONLINE_THRESHOLD_MS` (60s, `apps/api/src/lib/liveness.ts`
— the same threshold the worker fleet uses). This surfaces on:

- `GET /api/v1/status` (public) — a `discord-bot` row, automatically.
- `GET /api/admin/stats/system-health` (board) — `discordBot: 'up' | 'down'`,
  shown as a `StatusPill` on `/admin/dashboard`'s System health card, next to
  a "Restart Discord bot" button.

## Player UI

`packages/tahti-web` (Tahti Player): `DiscordBotAddonCard` under Settings →
Add-ons → Tools. Board-only; Configure opens a dialog for Client ID + token.

## Migration

`packages/db/prisma/migrations/20260903220000_discord_bot_settings` creates
`admin.DiscordBotSettings`. `..._discord_bot_restart_audit_action` adds the
`DISCORD_BOT_RESTART` `AuditAction` value.
