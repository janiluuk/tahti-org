# Tahti Radio Discord bot credentials (2026-09-03)

## Requested

Store the Discord application Client ID and bot token as `.env` settings for
the Tahti Radio Discord bot, and let board admins edit them from Tahti Player
Settings → Add-ons (Radio). The configure surface is board-only.

## Implementation

- Discord bot (`.env.local`, gitignored) holds `DISCORD_CLIENT_ID` and
  `DISCORD_TOKEN`. `.env.example` documents the names without secrets.
  Optional `TAHTI_API_BASE` + `INTERNAL_SECRET` load the same values from
  Tahti so an admin save takes effect without a rebuild.
- Tahti API stores a singleton `DiscordBotSettings` row (`admin` schema).
  The token is AES-GCM encrypted at rest (`encryptStreamKey`). Board
  `GET`/`PUT /api/admin/discord-bot` never returns the raw token (hint of
  last four characters only). Internal
  `GET /api/v1/internal/discord-bot/credentials` returns the plaintext token
  to the bot with `INTERNAL_SECRET`. Env `DISCORD_CLIENT_ID` /
  `DISCORD_TOKEN` on the API are a fallback when no row exists.
- Tahti Player (`packages/tahti-web`) adds a Radio add-on card owned by
  `src/plugins/discord-bot`. It is rendered only for board accounts.

## Not done

The bot still plays its local `tracks.txt` playlist. Wiring playback to
Tahti Radio (`GET /api/v1/radio`) is a follow-up. Fly still needs
`INTERNAL_SECRET` set as a secret if the deployed bot should read API-saved
credentials.
