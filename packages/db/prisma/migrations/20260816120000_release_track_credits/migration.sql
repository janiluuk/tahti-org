-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (C) 2026 Tahti ry <https://tahti.live>

-- Per-song credits (role/name), independent of Release.credits (whole-album credits).
ALTER TABLE "release"."ReleaseTrack"
  ADD COLUMN "credits" JSONB;
