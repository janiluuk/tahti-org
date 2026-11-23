# Clean imported album track titles (`clean-album-track-titles.ts`)

**Status:** open

**Why:** Yaniho's tracks imported from hearthis.at are titled
`<artist> - <album> - <NN> - <track title>` (e.g. "yaniho - euphorizer LP - 02 -
Particular particle") and sit in a collection named like the album part. They
should read "Particular particle" and sit at position 2 of "euphorizer LP".

## Shipped

- #1130: `parseAlbumTrackTitle` / `splitAlbumTrackTitle` in
  `packages/shared/src/track-title.ts`, `apps/api/src/lib/album-track-titles.ts` (plan,
  backup, apply, restore) and the one-off `apps/api/scripts/clean-album-track-titles.ts`.
- v2 (after the first production dry run): collaborator credits, LP/EP-insensitive album
  names, stable album order, `--create-missing`. Collection creation moved to
  `apps/api/src/lib/create-collection.ts`, shared with `POST /api/me/collections`.

## Rules

- A title is cut only when it starts with the collection's own name (after an optional
  credit), then a 1-3 digit number (`02 -` or `02.`), then the title. Case-insensitive;
  `-`, `–`, `—` and extra spaces are all accepted. A trailing `LP`/`EP` (or none) is the
  same album when the base name matches ("Sisufuzz EP - 07" belongs in "Sisufuzz LP").
- The credit must name the artist (username, display name, channel slug or a track's
  `artistName`), alone or among others split by `,`, `x`, `&`, `feat.`, `ft.`,
  `vs`. The others become a suffix: `Title (with Acraze)`, `Title (with Chisu &
Orkidea)`, `Title (with A, B & C)`, unless the title already names them. A credit
  without the artist is not album form.
- Only the collection owner's own tracks are renamed.
- Order (stable merge): numbered tracks by NN (ties keep current order, with a warning);
  every unnumbered item stays right after the item it follows now; items before the first
  numbered track stay first. Positions 1..n. Collections with no match are not touched.
  A collection sorted by NAME/TIME is reported, not changed.
- `--create-missing`: an album found in titles with no collection (LP/EP-insensitive)
  gets a new collection: the name as written (most common spelling), style ALBUM (EP if
  the name ends in EP), private (`isPublic: false`, `visibility: DRAFT`), owned by the
  artist, tracks in NN order. Of tracks with the same number and title only the newest
  upload is added; the others are listed as duplicates. Only READY sounds are added.
- A track in album form for an existing album it is not in is listed, never moved.
- The backup (version 2) records created collection ids as they are made. `--restore`
  puts titles and positions back and deletes a created collection only while it holds
  nothing but the script's items.

## Left

- [ ] After merge + deploy: dry run on production with `--create-missing`, check the
      output, apply, keep the backup in `/srv/tahti/backups/` (commands in the PR body).
- [ ] The artist reviews and publishes the new private albums.
