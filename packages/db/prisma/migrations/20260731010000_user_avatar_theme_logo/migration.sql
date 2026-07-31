-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (C) 2026 Tahti ry <https://tahti.live>

-- Themeable avatar fill (solid / gradient JSON) plus optional alpha logo overlay.
ALTER TABLE "core"."User"
  ADD COLUMN "avatarThemeJson" TEXT,
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "logoPlacement" TEXT;
