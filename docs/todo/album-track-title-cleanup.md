# Clean imported album track titles (`clean-album-track-titles.ts`)

**Status:** open

**Why:** Yaniho's tracks imported from hearthis.at are titled
`<artist> - <album> - <NN> - <track title>` (e.g. "yaniho - euphorizer LP - 02 -
Particular particle") and sit in a collection named like the album part. They
should read "Particular particle" and sit at position 2 of "euphorizer LP".

## Shipped in the PR

- `parseAlbumTrackTitle` / `splitAlbumTrackTitle` in `packages/shared/src/track-title.ts`.
- `apps/api/src/lib/album-track-titles.ts` (plan, backup, apply, restore) and the
  one-off `apps/api/scripts/clean-album-track-titles.ts`.

## Rules

- A title is cut only when it starts with the collection's own name (after an
  optional artist name: username, display name, channel slug or a track's
  `artistName`), then a 1-3 digit number (`02 -` or `02.`), then the title.
  Case-insensitive; `-`, `–`, `—` and extra spaces are all accepted.
- Only the collection owner's own tracks are renamed.
- Order: matched tracks first by number (ties keep current order), then every
  other item in its current order; positions 1..n. Collections with no match
  are not touched. A collection sorted by NAME/TIME is reported, not changed.
- Titles in album form outside a matching collection are listed, not changed.

## Left

- [ ] After merge + deploy: dry run on production, check the output, apply, keep
      the backup in `/srv/tahti/backups/` (commands in the PR body).
