-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (C) 2026 Tahti ry <https://tahti.live>

-- AcoustID fingerprint lookup result, populated automatically on upload.
ALTER TABLE "release"."ReleaseTrack"
  ADD COLUMN "fingerprintMatch" JSONB;
