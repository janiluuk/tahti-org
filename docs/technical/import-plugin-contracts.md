# Import plugin capability contracts

Source of truth for the versioned `GET /api/me/import-plugins` registry in
`@tahti/shared` (`dto/import-plugin.ts`) and
`apps/api/src/lib/import-plugin-providers.ts`.

## Why three kinds

Import sources do not share one `start/status/import` shape:

| Kind              | Lifecycle                                              | Typical routes                                         |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| `oauth`           | Connect → status → optional list → import → disconnect | `/api/me/{provider}/oauth/start`, `/api/me/{provider}` |
| `search`          | Search → select → add/import (no OAuth account)        | `/api/v1/imports/{provider}/search`, `/add`            |
| `tool` / `upload` | Paste URL, local file, or stash locker                 | Studio upload / stash / releases deep links            |

Tahti Player must keep separate adapter interfaces for these kinds.
Do not force search or paste-a-link tools through an OAuth connect modal.

## Client boundary

- **Tahti core** owns routes, OAuth, encrypted credentials, import jobs, and
  this metadata registry.
- **Tahti Player** owns Configure UI, adapter interfaces, and
  provider-specific cards in Settings → Add-ons (Import).
- Configuration stays in the player Configure action: enter settings, test,
  save, then enable. Do not add a parallel configuration surface in
  `apps/web`.

## Desktop set download (SoundCloud)

Tahti Player's desktop app can download a SoundCloud playlist/set into its
local library. The tracks go to the user's own disk and are never stored by
Tahti.

| Route                                                                    | Auth              | Returns                                                                     |
| ------------------------------------------------------------------------ | ----------------- | --------------------------------------------------------------------------- |
| `GET /api/me/soundcloud/playlists`                                       | session           | The connected user's playlists, without their tracks                        |
| `GET /api/me/soundcloud/resolve?url=`                                    | session           | A pasted `soundcloud.com` set link, resolved to a playlist                  |
| `GET /api/me/soundcloud/playlists/:id/tracks`                            | session           | Tracks in set order. Downloadable ones carry `download: { url, expiresAt }` |
| `GET` or `HEAD` `/api/v1/imports/soundcloud/tracks/:id/download?ticket=` | the signed ticket | `302` to SoundCloud's file                                                  |

- The desktop downloader has no Tahti session, so each download link carries
  a signed ticket for one user and one track. It expires after 12 hours;
  reload the playlist to get fresh links.
- On every use, the download route checks again that the track is still
  downloadable, then redirects to SoundCloud's file URL. The OAuth token is
  sent only to `api.soundcloud.com` and never reaches the client.
- Only tracks SoundCloud marks as `downloadable` get a link. Stream-only
  tracks are listed with `download: null` and are never offered.
- Error codes: `410` means the link expired, `403` means the track is no
  longer downloadable or SoundCloud is not connected, and `401` means the
  SoundCloud token expired (it is cleared).

## Export / DSP delivery

Behavioral `ExportProvider` contracts live in
[`export-plugin-contracts.md`](export-plugin-contracts.md)
(`GET /api/me/export-plugins`). Import adapters must not absorb submit /
status / webhook shapes.

## Parity checklist for new providers

1. Add a row to `IMPORT_PLUGIN_PROVIDERS` with the correct `kind`.
2. Point `oauthStartPath` / `statusPath` / `searchPath` / `listPath` /
   `importPath` at real routes (or `null` when not applicable).
3. Extend the Tahti Player adapter of the matching kind; do not widen OAuth cards
   to cover search/tool behavior.
4. Cover registry parsing in `@tahti/shared` tests and the provider list in
   API tests when behavior is added.
5. If the provider is (or should be) listed in the player Store, update
   sibling `../tahti-registry` in the same work: new row when added, version
   bump in `plugins.json` when changed. Users see Store listings from that
   repo, not from this API catalog. See root `AGENTS.md`.
