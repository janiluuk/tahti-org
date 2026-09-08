# Release artwork: delete/clear

**Status:** done, pending merge (2026-09-08).

## Background

Release artwork had upload/complete/from-url routes but no way to clear it
once set. The shared `CoverImageUpload` widget already renders a "Remove"
(✕) button once a cover exists, and calls `onUploaded(null)` — but
`ReleaseArtworkUpload`'s `onUploaded` ignored its argument and just called
`router.refresh()`, so clicking Remove never persisted: a refresh re-fetched
the release from the server, which still had `artworkKey`/`artworkUrl` set,
and the image reappeared.

## What shipped

- `apps/api/src/routes/releases/artwork.ts`: `DELETE
  /api/me/releases/:id/artwork`, mirroring the existing ownership check
  (`ownedRelease`) used by the other artwork routes. Nulls
  `artworkKey`/`artworkUrl`, 404s for a release the caller doesn't own.
- `apps/api/src/routes/releases/artwork.test.ts`: clear + ownership tests.
- `apps/web/src/app/dashboard/release-actions.ts`: `deleteReleaseArtwork(releaseId)`
  server action calling the new route.
- `apps/web/src/app/dashboard/release-artwork-upload.tsx`: `onUploaded` now
  branches on `url === null` and calls `deleteReleaseArtwork` before
  refreshing, instead of discarding the argument.

## Verification

`apps/api`: `vitest run src/routes/releases/artwork.test.ts` — 2/2 pass.
`apps/web`: `tsc --noEmit` and `eslint` clean on both changed files.

## Not done here

- Manual browser check of the Remove button in the release detail page
  (`/dashboard/releases/[id]`) was not run — no dev server available in
  this session's flow. Worth a quick click-through before merge if the
  reviewer wants extra confidence.
