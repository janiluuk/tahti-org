-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (C) 2026 Tahti ry <https://tahti.live>

-- Scheduled live shows now carry an optional endAt so recurrenceDurationMin
-- (and intervalHours fallback) can drive overlap checks and public end times.

ALTER TABLE "channel"."ScheduledLiveShow" ADD COLUMN "endAt" TIMESTAMP(3);
