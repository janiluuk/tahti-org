# Library management port (theDAW → cloud Sounds API)

**Status:** partial  
**Updated:** 2026-11-10  
**Sibling:** `../tahti-player/docs/todo/library-management-port.md` (UI)

Port theDAW `/api/library` management patterns onto the artist's cloud Sounds
catalog. DAW-only surfaces (lineage, stems/MIDI/scores, media-roots, setlists,
index-status) are out of scope. Native desktop library work stays in the
player's `desktop-pro-library.md`.

## Shipped

- [x] Paged list / ids / facets / stats / bulk-delete / bulk-patch / suggest-playlist
- [x] Shared DTOs + unit tests; integration suite written
- [x] Genre facets include `genreCustom` (`feat/library-mgmt-followups`, #1088)
- [x] Bulk-by-ids report missing/foreign in `failed[]`
- [x] Bulk-patch `isFallback` respects `MAX_FALLBACK_ITEMS`
- [x] Bulk-patch `isPublic: true` notifies followers (private→public)
- [x] OpenAPI bulk request bodies + 400/403/409 shapes
- [x] OpenAPI dual `GET /api/me/sound` (`SoundListResponse` union)
- [x] Facets `tag` via SQL `unnest` (no 5k sample)
- [x] Facets `uploadedYear` omits date filters when bucketing
- [x] `sound-library-mgmt.test.ts` runs in the Postgres vitest job
- [x] `POST /api/me/sound/covers/backfill` (preset covers for null banners)
- [x] Bulk mutate `where` includes `channelId`
- [x] Suggest playlist (duration/flow) beyond Mix order — **wontfix**; Mix
      order + `POST /api/me/sound/suggest-playlist` cover the need

## Player-owned leftovers

See sibling todo for UI slices 11–18 and 20 (filters, bulk edit fields,
selection a11y, covers UI, e2e).

## Deferred outside this port

- Native desktop Phase 6–7 (`desktop-pro-library.md`)
- DAW lineage / stems / media-roots / setlists
- Optional iTunes copy-into-folder mode (import already links in place)
