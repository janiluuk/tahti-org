# Scrobble plugin contracts

Submit-listens scrobbling uses the integrations marketplace credential
store — same install / uninstall routes as import, export, and fingerprint
providers. There is no separate scrobble credential API.

## Scope

`SCROBBLE` in `packages/shared/src/integration-providers.ts`.

## Live providers

### ListenBrainz

| Capability | Behavior                                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install    | `POST /api/me/integrations/listenbrainz/install` with `{ userToken }`. Installer calls ListenBrainz `GET /1/validate-token` and stores the token only when valid.                                                          |
| Scrobble   | After a successful `POST /api/listen-events` (`recorded: true`) for a signed-in user with ListenBrainz installed, the API fire-and-forgets `POST https://api.listenbrainz.org/1/submit-listens` (`listen_type: "single"`). |

### Last.fm

| Capability | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connect    | Studio **Connect** opens a modal for the user's Last.fm **API key** + **shared secret** (`POST /api/me/integrations/lastfm/prepare`). Keys are held in short-lived httpOnly cookies while Last.fm desktop auth runs; `…/oauth/callback` exchanges the token via `auth.getSession` and stores `{ apiKey, apiSecret, sessionKey, username }` in `IntegrationCredential`. Platform `LASTFM_API_KEY` / `LASTFM_API_SECRET` remain an optional fallback for `GET …/oauth/start` without a prepare step. |
| Disconnect | `DELETE /api/me/integrations/lastfm` (credential-store OAuth — no User column).                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Scrobble   | Same listen-events hook; fire-and-forgets Last.fm `track.scrobble` using the credential's API key/secret when present, otherwise the platform env pair, plus the stored session key.                                                                                                                                                                                                                                                                                                               |

Scrobble failures never change the listen-events response (`recorded` stays
true). ListenBrainz client name in `additional_info.submission_client` is
`tahti`. Charts / recommendations / Now Playing are out of scope.

## Related

- Credential lifecycle: [`integration-credential-lifecycle.md`](integration-credential-lifecycle.md)
