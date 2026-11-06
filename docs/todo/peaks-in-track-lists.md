# Waveform peaks in track list responses

**Status:** partial

Every list the web app draws as waveform rows should carry `Sound.peaks` (600 buckets, 0..255) so the browser never downloads and decodes audio for a row. Paired player PR: tahti-player `feat/slices-d-server-peaks`.

## Done

- [x] `GET /api/v1/search` tracks return `peaks` (`SearchTrackResultSchema.peaks`, optional). The MCP `search` tool strips them.
- [x] `GET /api/v1/tahti-selects/gallery` and `GET /api/discover/new-to-you` items return `peaks` (`TahtiSelectsGalleryItemSchema.peaks`, set in `toGatedGalleryItem`). New to you reads peaks for the picked rows only, not the candidate pool.
- [x] Backfill sweep (`sweep-editor-peaks-backfill`) only picks sounds with audio, so embed-only sounds can't hold the head of the oldest-first batch. A sound whose audio yields no waveform gets `peaks: []` and leaves the sweep until a new transcode writes real peaks.
- [x] Tests: search, Selects gallery and New to you integration assertions (CI); worker unit tests for the sweep filter and the empty marker.

Already returned peaks before this: channel items, public profile tracks, public collections, smart links, release embeds, likes, latest tracks, track detail, studio `GET /api/me/sound`.

## Left

- [ ] `GET /api/me/collections/:slug` (studio editor), `GET /api/v1/radio/recently-played`, `GET /api/me/feed`: no peaks. The player renders these as tables or cards, not waveform rows.
- [ ] A sound whose editor-peaks pyramid fails to extract keeps `editorPeaks` null and stays in the sweep.
- [ ] Transcode jobs keep the old `peaks` when extraction of new audio fails (`?? undefined`).
