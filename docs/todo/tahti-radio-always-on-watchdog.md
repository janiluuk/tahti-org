# Tahti Radio always-on watchdog

**Status:** open

## Goal

Tahti Radio (and Selects) must not stay silent after a Liquidsoap crash or a
watchdog restart burst. Failsafe: keep restarting always-on channels with
backoff; force-restart when minute spawn reports down; recover script for ops.

## Plan

1. Watchdog: always-on slugs ignore the artist restart cap (burst + interval).
2. `radio-slot-switchover`: force `/restart` when spawn reports down.
3. Fallback reconciler bootstraps OFFLINE `tahti-selects` with rotation.
4. `scripts/recover-tahti-radio.sh` for host recovery + clear Redis counters.
