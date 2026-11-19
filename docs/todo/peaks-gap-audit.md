# Peaks DTO / pipeline gap audit

**Status:** partial  
**Updated:** 2026-11-19  
**Parent:** `../tahti-player/docs/todo/server-peaks-everywhere.md`

## Shipped

- Surfaces that select `peaks` (channel items, search, Selects gallery,
  collections, feed, radio recently-played).
- Transcode extracts peaks inline; missing after READY enqueues
  `backfill-editor-peaks`.
- Sweep cron batches READY rows with null peaks/editorPeaks.
- Prometheus gauge `tahti_sounds_ready_missing_peaks` on `GET /metrics`
  (same READY ∩ audio ∩ null peaks/editorPeaks filter as the sweep).

## Ops

Dry-run (no enqueue):

```bash
DATABASE_URL=… node scripts/peaks-gap-audit.mjs --slug yaniho
```

Enqueue only with explicit ops OK (batches 48):

```bash
DATABASE_URL=… REDIS_URL=… node scripts/peaks-gap-audit.mjs --slug yaniho --enqueue
```

## Still open

Prod Yaniho dry-run + enqueue when credentials/LAN available; live verify
waveforms on channel pages after backfill.
