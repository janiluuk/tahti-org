# Worker lane hand-off (transcode jobs failing on the wrong worker)

**Status:** partial

## Problem (production, 2026-11-11)

Every job goes to the one BullMQ queue `media`. Workers filter by lane
(`--queues=...`, `packages/shared/src/worker-job-lanes.ts`). The vimage stack
worker runs `--queues=media,light,dist`; the `transcode` lane runs only on
vimage7. A worker that dequeued another lane's job threw `lane-mismatch`, which
used up an attempt, and the vimage worker usually won the race, so transcode
jobs failed for good. 67 uploads were stuck `PENDING` (rawKey set, no mp3Key)
and `hearthis-embed-localize` failed on its first try.

## Shipped in this PR

- [x] `apps/worker/src/lib/lane-handoff.ts`: wrong-lane jobs go back with
      `job.moveToDelayed(now + 2-5s, token)` + `DelayedError` (skips the
      attempt count). Repeat ticks are dropped after 20 hand-offs so a lane with
      no worker does not pile them up. The worker's `active` event ignores
      handed-off jobs so the registry does not show them as processing.
- [x] `apps/worker/src/lib/sound-transcode-failed.ts`: worker `failed` event
      marks a PENDING/PROCESSING sound `ERROR` once `transcode-sound` used its
      last attempt (or hit an UnrecoverableError).
- [x] `POST /api/me/sound/:id/retry-processing` also accepts a sound PENDING
      for over 30 minutes (still a conditional update).
- [x] `sweep-stuck-sound-transcodes` subtask on `media-ten-minute-tick`:
      re-queues up to 20 PENDING/PROCESSING sounds with rawKey untouched for an
      hour and no live `transcode-sound` job.
- [x] `clearFinishedJob` (`@tahti/shared`): fixed-jobId enqueues
      (`hearthis-embed-localize`, `encode-streaming-copy`,
      `backfill-editor-peaks`) remove a finished job with that id first.
- [x] `GET /api/admin/workers` returns `laneCoverage` (online workers per lane).
- [x] `hearthis-embed-localize` failure: the embed stays `READY` and playable,
      so no status change; a failure after the rawKey write leaves the sound
      PENDING with rawKey, which the sweep picks up.

## Left

- [ ] Deploy (merging `main` deploys production), then confirm no new
      `lane-mismatch` failures in `bull:media:failed`.
- [ ] Recover the 67 stuck sounds: the sweep re-queues 20 per 10 min, or call
      `retry-processing` per id.
- [ ] Player: Admin Workers panel warns when a lane's `onlineWorkers` is 0.
- [ ] `hearthis-export` (dist lane) has the same fixed-jobId re-enqueue issue;
      apply `clearFinishedJob` there too.
