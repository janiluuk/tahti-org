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

## Next 20 slices (in order)

One PR each. **Org** = this repo; **Player** = sibling. Stack related org→player pairs.

| # | Repo | Slice | Done when |
| - | ---- | ----- | --------- |
| 1 | org | Bulk-by-ids: put non-owned / missing ids in `failed[]` (or 400), do not silently drop | `sound-library-mgmt` asserts foreign id in `failed` |
| 2 | org | Bulk-patch `isFallback`: reuse single-PATCH rotation / `MAX_FALLBACK_ITEMS` | Cannot exceed fallback cap via bulk |
| 3 | org | Bulk-patch `isPublic: true`: call `notifyFollowersOfNewTrack` when flipping private→public | Same notify path as single PATCH |
| 4 | org | OpenAPI: register bulk request bodies + 400/403/409 (`totalMatched`) on bulk routes | Scalar shows request + error shapes |
| 5 | org | OpenAPI: dual `GET /api/me/sound` response (`array` \| page) or split path | Generated client types honest |
| 6 | org | Facets `tag`: SQL/`unnest` (or unbounded scan with documented cap) instead of `take: 5_000` | Test with >5k tagged rows or documented limit |
| 7 | org | Facets `uploadedYear`: omit `uploadedFrom`/`uploadedTo` when bucketing years | Years reflect other filters only |
| 8 | org | Run `sound-library-mgmt.test.ts` in CI (Postgres job) | Green on every PR that touches sound list |
| 9 | org | `POST /api/me/sound/covers/backfill` — re-read embedded art for sounds with no banner (theDAW parity) | Route + worker/job + test |
| 10 | org | Bulk-patch: optional `channelId` on mutation `where` (defense in depth) | Update `where: { id, channelId }` |
| 11 | player | List filters UI: BPM min/max + key (API already supports) | SoundFilters + serverFilter |
| 12 | player | List filters UI: status + visibility + pinned | SoundFilters + serverFilter |
| 13 | player | Bulk edit: `genreCustom` when genre is Other | SoundsBulkEditDialog |
| 14 | player | Bulk edit: license + downloads + comments toggles | Dialog + i18n |
| 15 | player | Bulk edit: `releasedAt` (+ clear); gate `isFallback` or omit with copy | Dialog + API parity after #2 |
| 16 | player | Selection a11y: checkboxes in comfortable/compact **or** clear selection on density leave list | One consistent path |
| 17 | player | List view: one selection toolbar (SoundsSelectionBar **or** CatalogTable, not both) | No duplicate `role="toolbar"` |
| 18 | player | Covers backfill UI on Library → Sounds (calls #9) | Button + progress/toast |
| 19 | org+player | Library-wide Suggest playlist (duration / flow) API — only if product still wants beyond Mix order | Spec + route or wontfix |
| 20 | player | E2E journey: filter → select-all-matching → bulk edit + delete + Mix order (mock) | Journey green on CI |

## Deferred outside these 20

- Native desktop Phase 6–7 (`desktop-pro-library.md`)
- DAW lineage / stems / media-roots / setlists
