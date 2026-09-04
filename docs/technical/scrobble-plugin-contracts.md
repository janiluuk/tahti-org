# Scrobble plugin contracts

Submit-listens scrobbling uses the integrations marketplace credential
store — same install / uninstall routes as import, export, and fingerprint
providers. There is no separate scrobble credential API.

## Scope

`SCROBBLE` in `packages/shared/src/integration-providers.ts`.

## Live provider: ListenBrainz

| Capability | Behavior |
| ---------- | -------- |
| Install    | `POST /api/me/integrations/listenbrainz/install` with `{ userToken }`. Installer calls ListenBrainz `GET /1/validate-token` and stores the token only when valid. |
| Scrobble   | After a successful `POST /api/listen-events` (`recorded: true`) for a signed-in user with ListenBrainz installed, the API fire-and-forgets `POST https://api.listenbrainz.org/1/submit-listens` (`listen_type: "single"`). |

Scrobble failures never change the listen-events response (`recorded` stays
true). Client name in `additional_info.submission_client` is `tahti`.

## Related

- Credential lifecycle: [`integration-credential-lifecycle.md`](integration-credential-lifecycle.md)
