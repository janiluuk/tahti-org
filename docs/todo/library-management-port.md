# Library management port (theDAW → cloud Sounds API)

**Status:** partial  
**Updated:** 2026-11-10  
**Sibling:** `../tahti-player/docs/todo/library-management-port.md` (UI)

Port theDAW `/api/library` management patterns onto the artist's cloud Sounds
catalog. DAW-only surfaces (lineage, stems/MIDI/scores, media-roots, setlists,
index-status) are out of scope. Native desktop library work stays in the
player's `desktop-pro-library.md`.

## API checklist (this repo)

- [x] Widen `SoundListQuerySchema`: `q`, `limit`/`offset`, filters
- [x] `GET /api/me/sound` returns `{ items, total }` when `limit` is set; bare
      GET keeps the legacy array for CLI/pickers
- [x] `GET /api/me/sound/ids` (same filter; cap 50k)
- [x] `GET /api/me/sound/facets` (genre buckets include `genreCustom`)
- [x] `GET /api/me/sound/stats`
- [x] `POST /api/me/sound/bulk-delete` (`ids` | `filter`+`confirmTotal`)
- [x] `POST /api/me/sound/bulk-patch`
- [x] `POST /api/me/sound/suggest-playlist` (Camelot/BPM mix order; shipped)
- [x] Shared DTOs + OpenAPI + unit tests (`sound-list-mgmt.test.ts`);
      integration suite `sound-library-mgmt.test.ts` written (needs local Postgres)

## Deferred

- Cover/artwork bulk backfill beyond existing banner routes
- Full theDAW Suggest playlist modal (target duration / flow) — Mix order on a
  selection is enough for now
