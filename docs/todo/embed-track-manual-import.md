# Manual "Import" button for downloadable embed tracks

Status: open, not started.

## Request

For an embed-sourced track whose original host offers a download, add
an "Import" button in the track editor's Audio tab
(`apps/web/src/app/dashboard/sound-editor.tsx`, `tab === 'audio'`
section, next to `SoundVersionPanel`/`SoundDownloadPanel`) that pulls
the real audio file down, attaches it as the track's actual recording,
and clears the track's embed status.

## A working version of this already exists — for HEARTHIS only, automatic, and incomplete

`apps/api/src/routes/imports/hearthis.ts` (~line 198) already does this
exact thing, but only:

- **automatically**, once, at initial hearthis.at import time (checks
  `track.downloadable === '1' && track.download_url`, then calls
  `enqueueHearthisEmbedLocalization`) — there's no way to re-trigger it
  later for a track that already exists, which is what a manual
  "Import" button would add.
- **for `HEARTHIS_EMBED` only.** `SPOTIFY_EMBED` has no download API
  (Spotify doesn't allow it) and `MIXCLOUD_EMBED` explicitly can't
  either — see the existing "Mixcloud rescue" flow's own copy
  (`apps/web/src/app/dashboard/upload/import/mixcloud-rescue/page.tsx`):
  "Mixcloud doesn't let anyone — including you — download the audio."
  So in practice this "if it provides a download option" gate probably
  only ever applies to `HEARTHIS_EMBED` (and maybe `URL_EMBED`, if the
  stored URL happens to point at a direct downloadable file — not
  checked anywhere today).

The actual download+replace logic lives in
`apps/worker/src/jobs/hearthis-embed-localize.ts`
(`processHearthisEmbedLocalizationJob`): fetches `track.download_url`,
uploads it to MinIO as a new `rawKey`, and updates the `Sound` row with
`{ rawKey, fileSizeBytes, source: 'HEARTHIS', status: 'PENDING' }`, then
enqueues transcoding. **This already does most of what's needed** — a
manual trigger would call the same job (or a thin wrapper) on demand.

## Bug found while investigating: embed status is never actually cleared

`processHearthisEmbedLocalizationJob` sets `source: 'HEARTHIS'` but does
**not** clear `embedUri`, `embedProvider`, `contentType` (stays
`'EMBED'`), or `qualityBadge` (stays `'EMBED_ONLY'`). The editor's own
embed check —
`const hasEmbed = Boolean(item.embedUri)` (`sound-editor.tsx:223`) —
means a track localized through the _existing, already-shipped_
automatic hearthis flow still renders as an embed in the editor and
public profile (embed-only playback UI,
`play?.embedUri && play.embedProvider === 'HEARTHIS'` branches
throughout `sound-editor.tsx`). This looks like a real pre-existing bug,
not something introduced by this task — worth fixing regardless of
whether the manual-import-button feature ships, since it directly
matches the user's own phrasing ("removes the embed status from the
track") that isn't actually happening today even in the one automatic
case that exists.

## What's needed

- A new manual-trigger endpoint (candidates: `apps/api/src/routes/me/sound.ts`
  or `sound-crud.ts`, alongside other per-track actions) that re-enqueues
  the localize job for an existing `HEARTHIS_EMBED` sound the caller owns.
- Fix `processHearthisEmbedLocalizationJob` (or wherever the update
  lands after a refactor) to also clear `embedUri`, `embedProvider`, set
  `contentType` back to whatever non-embed tracks use, and update
  `qualityBadge` off `EMBED_ONLY` once real audio is attached.
- An "Import" button in `sound-editor.tsx`'s Audio tab, shown only when
  `item.embedUri && item.embedProvider === 'HEARTHIS'` (until/unless
  other providers gain a real download path) — likely also needs the
  hearthis `downloadable` flag re-checked at button-render time (or
  optimistically shown and handled server-side if not downloadable).
- Decide UI feedback for the async part: the actual localize+transcode
  is a background job (same pattern as `SoundVersionPanel`'s existing
  processing states) — button should reflect pending/done, not block.
