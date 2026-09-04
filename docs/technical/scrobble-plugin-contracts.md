# Scrobble plugin contracts

Submit-listens scrobbling uses the integrations marketplace credential
store — same install / uninstall routes as import, export, and fingerprint
providers. There is no separate scrobble credential API.

## Scope

`SCROBBLE` in `packages/shared/src/integration-providers.ts`.

## Live providers

### ListenBrainz

| Capability | Behavior |
| ---------- | -------- |
| Install    | `POST /api/me/integrations/listenbrainz/install` with `{ userToken }`. Installer calls ListenBrainz `GET /1/validate-token` and stores the token only when valid. |
| Scrobble   | After a successful `POST /api/listen-events` (`recorded: true`) for a signed-in user with ListenBrainz installed, the API fire-and-forgets `POST https://api.listenbrainz.org/1/submit-listens` (`listen_type: "single"`). |

### Last.fm

| Capability | Behavior |
| ---------- | -------- |
| Connect    | `GET /api/me/integrations/lastfm/oauth/start` (optional `?returnTo=` allowlisted URL). Requires `LASTFM_API_KEY` + `LASTFM_API_SECRET`. Redirects through Last.fm desktop auth, then `…/oauth/callback` exchanges the token via `auth.getSession` and stores `{ sessionKey, username }` in `IntegrationCredential`. |
| Disconnect | `DELETE /api/me/integrations/lastfm` (credential-store OAuth — no User column). |
| Scrobble   | Same listen-events hook; fire-and-forgets Last.fm `track.scrobble` when a session key is present. |

Scrobble failures never change the listen-events response (`recorded` stays
true). ListenBrainz client name in `additional_info.submission_client` is
`tahti`. Charts / recommendations / Now Playing are out of scope.

## Related

- Credential lifecycle: [`integration-credential-lifecycle.md`](integration-credential-lifecycle.md)
