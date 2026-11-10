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

## Next 30 slices (in order)

Canonical table; player-owned rows are blockers for sibling UI. Stack org→player
pairs. PR for the prior 20: #1089.

| # | Repo | Slice | Done when |
| - | ---- | ----- | --------- |
| 1 | org | Document `413` (+ `totalMatched`) on `GET /api/me/sound/ids` in OpenAPI | ✅ Route schema + Scalar show 413 body |
| 2 | org | Regenerate `@tahti/api-client` from OpenAPI for list/ids/facets/stats/bulk/covers | `generate` types cover those paths |
| 3 | org | Bulk-patch `pinned` in schema + handler | ✅ Can set/clear pin; test `pinnedAt` |
| 4 | org | Bulk-patch clear-tags: allow `tags: []` (replace semantics) | ✅ Empty array clears; OpenAPI + test |
| 5 | org | Multi-tag list filter (`tags` AND, keep single `tag`) | ✅ Zod + where + tests |
| 6 | org | Add `musicalKey` to facet fields + groupBy | ✅ Key buckets in facets response |
| 7 | org | Harden `uploadedYear` facet (SQL year bucket, not JS 20k scan) | ✅ Correct under date filters |
| 8 | org | Admin `DELETE /api/admin/channels/:slug/sound/:itemId` + audit | ✅ Board remove + audit |
| 9 | org | Admin list dual GET: `limit`/`offset` + same filters as me/sound | ✅ Drop hard `take: 200` for paged |
| 10 | org | Integration tests: uploadedYear date-omit + bulk private→public notify | Green in Postgres job |
| 11 | player | Honesty toast when bulk `ok` but `failed.length > 0` | ✅ Toast shows updated + failed |
| 12 | player | Map 409 `totalMatched` to re-confirm dialog | Retry with server `confirmTotal` |
| 13 | player | Surface ids `413` as toolbar `selectionNotice` | ✅ Cap message + refine CTA |
| 14 | player | Pass `serverFilter` into facets fetch; refetch on filter change | ✅ Counts shrink with filters |
| 15 | player | `uploadedYear` facet Select → year date bounds | Year dropdown from facets |
| 16 | player | Facet-backed counts on contentType / source / status | Labels `value (count)` |
| 17 | player | `isFallback` filter (API already supports) | ✅ Select + clearFilters + serverFilter |
| 18 | player | Always-visible Clear filters when `filtersActive` | ✅ Button in filter chrome |
| 19 | player | Active-filter chip strip | Per-chip remove |
| 20 | player | Search `Input` clear `endAddon` idle→active | ✅ Matches Storybook rule |
| 21 | player | Shift-click range select via ordered ids | Inclusive range across pages |
| 22 | player | Bulk edit: `subGenres` | Dialog + API |
| 23 | player | Bulk edit: clear-tags (after #4) | Explicit `tags: []` |
| 24 | player | Bulk genre options from live genre facets | Facet values + Other |
| 25 | player | Stats strip clickable → filters | Sets visibility/status |
| 26 | player | Tag multi-select filter UI (after #5) | AND tags |
| 27 | player | `musicalKey` facet Select (after #6) | Facet buckets |
| 28 | player | Admin ChannelTracksPanel: Remove + richer edit | Admin delete + patch fields |
| 29 | player | Admin channel tracks paged/filtered (after #9) | No silent 200 cap |
| 30 | player | Harden bulk e2e + unit tests for #11/#14/#21 | Stable a11y names; coverage |

## Deferred outside this port

- Native desktop Phase 6–7 (`desktop-pro-library.md`)
- DAW lineage / stems / media-roots / setlists
- Optional iTunes copy-into-folder mode (import already links in place)
