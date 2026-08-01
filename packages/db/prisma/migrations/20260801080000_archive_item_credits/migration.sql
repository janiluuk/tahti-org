-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (C) 2026 Tahti ry <https://tahti.live>

-- Per-track structured credits (role/name) when they differ from the channel roster.
ALTER TABLE "channel"."ArchiveItem"
  ADD COLUMN "credits" JSONB;
