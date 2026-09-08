# Recurrence duration → endAt + overlap

**Status:** shipping on `fix/recurrence-duration-overlap`.

## Goal

`LiveShowSeries.recurrenceDurationMin` was stored from the schedule UI but never
applied. Use it (falling back to `intervalHours`) to set
`ScheduledLiveShow.endAt` and skip overlapping generated/manual episodes.

## Plan

1. Migration: nullable `ScheduledLiveShow.endAt`.
2. Shared helpers: duration resolution, range overlap, filter candidates.
3. Wire API immediate generate + worker cron + manual schedule (409 on conflict).
4. Surface end time in studio schedule list.

## Leftovers

- Public channel schedule cards may still show start-only (out of scope here).
