# Tahti Radio Discord bot — API contracts

Board admins configure the Discord application Client ID and bot token from
Tahti Player → Settings → Add-ons → Tools. The bot process loads the same
values over an internal endpoint so redeploys pick up admin saves without
baking secrets into the bot image.

These routes are **not** in the public OpenAPI document (`/api/openapi.json`).
They appear in the authenticated full reference (`GET /docs`) and in the
generated client under `packages/api-client`.

## Schemas (`@tahti/shared`)

| Schema                          | Role                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AdminDiscordBotSettings`       | Board-facing view: `clientId`, `tokenConfigured`, `tokenHint` (last four), `source` (`database` \| `env` \| `none`) |
| `UpdateDiscordBotSettings`      | Board PUT body: `clientId` (17–20 digit snowflake), optional `token` (min 20 chars)                                 |
| `InternalDiscordBotCredentials` | Bot fetch: plaintext `clientId` + `token`                                                                           |

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

## Player UI

`packages/tahti-web` (Tahti Player): `DiscordBotAddonCard` under Settings →
Add-ons → Tools. Board-only; Configure opens a dialog for Client ID + token.

## Migration

`packages/db/prisma/migrations/20260903220000_discord_bot_settings` creates
`admin.DiscordBotSettings`.
