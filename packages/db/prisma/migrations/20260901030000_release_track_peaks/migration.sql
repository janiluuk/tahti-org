-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (C) 2026 Tahti ry <https://tahti.live>

-- Cache waveform peaks on ReleaseTrack, same shape/purpose as ArchiveItem.peaks —
-- needed so embed players get a real waveform without a second request.
ALTER TABLE "release"."ReleaseTrack"
  ADD COLUMN "peaks" JSONB;
