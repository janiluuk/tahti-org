-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (C) 2026 Tahti ry <https://tahti.live>

CREATE TYPE "channel"."ArtistKind" AS ENUM ('SINGLE', 'COLLECTIVE');

ALTER TABLE "channel"."Channel"
  ADD COLUMN "artistKind" "channel"."ArtistKind" NOT NULL DEFAULT 'SINGLE';
