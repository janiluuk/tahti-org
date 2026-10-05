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

## Vocabulary map (do not conflate)

| Name | Backend | Player surface | Notes |
| ---- | ------- | -------------- | ----- |
| `GET /api/me/import-plugins` | Capability catalog (`import-plugin-providers.ts`) | Add-ons → Import | Route + capability discovery only |
| `GET /api/me/export-plugins` | Capability catalog (`export-plugin-providers.ts`) | Add-ons → Export | Revelator submit/status/webhook; storefront IDs are **deep-links**, not submit providers |
| `/api/me/integrations` | Per-user credentials | Configure / Connections | Install/uninstall secrets; not the Store |
| Add-ons | Channel/homepage widgets | Channel designer / store | Distinct from import/export catalogs |
| Store / `tahti-registry` | Marketplace JSON | Plugin/theme Store | Sibling repo; not `GET /api/me/import-plugins` |

Slug collisions to watch: import `hearthis` vs integration `hearthis-import` /
`hearthis-export`; import `mixcloud` (OAuth upload) vs `mixcloud-embed` (search);
export `spotify`/`apple`/… are deep-link labels that go through Revelator.

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

## Honesty rules

- If `capabilities.import` / `fileList` / `search` is true, the matching
  `importPath` / `listPath` / `searchPath` must be a real route.
- Never advertise a phantom path (e.g. Bandcamp import was wrongly
  `/api/v1/imports/bandcamp/add` with no handler — keep `import: false` until
  Bandcamp API v1 lands).
- OAuth Mixcloud connect (`id: mixcloud`) is for **upload/rescue to Mixcloud**,
  not catalog import. Catalog embed search is a separate search provider
  (`id: mixcloud-embed`) pointing at `/api/v1/imports/mixcloud/search` and
  `/api/v1/imports/mixcloud/add`.

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
