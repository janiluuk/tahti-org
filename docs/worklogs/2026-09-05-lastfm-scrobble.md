# 2026-09-05 — Last.fm scrobble (SCROBBLE)

Second scrobble provider on the integrations path:

- `lastfm` in `integration-providers.ts` (`SCROBBLE`, OAuth-style)
- Platform env `LASTFM_API_KEY` / `LASTFM_API_SECRET`
- `GET …/lastfm/oauth/start` + callback → `auth.getSession` →
  `IntegrationCredential` `{ sessionKey, username }`
- listen-events fire-and-forget `track.scrobble` alongside ListenBrainz
- Optional `?returnTo=` for Nuclear Add-ons return

Docs: `docs/technical/scrobble-plugin-contracts.md`.
