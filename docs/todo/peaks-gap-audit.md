# Peaks DTO / pipeline gap audit (slice 1–4)

**Status:** partial  
**Updated:** 2026-11-18  
**Parent:** `../tahti-player/docs/todo/server-peaks-everywhere.md`

## Surfaces that already select `peaks`

| Surface | Path | Notes |
| ------- | ---- | ----- |
| Channel items | `apps/api/src/routes/channels/items.ts` | `peaks: true` |
| Search | `apps/api/src/routes/discover/search.ts` | returns peaks |
| Tahti Selects gallery | `apps/api/src/routes/channels/tahti-selects-gallery.ts` | `peaks: true` |

## Pipeline

- Transcode extracts peaks inline; if missing after READY, enqueues `backfill-editor-peaks`.
- Sweep cron still batches READY rows with null peaks/editorPeaks.
- Dry-run / enqueue: `node scripts/peaks-gap-audit.mjs [--slug yaniho] [--enqueue]`

## Still open

Prod Yaniho backfill run; remaining player list surfaces; weekly metrics.
