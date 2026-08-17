-- SPDX-License-Identifier: AGPL-3.0-or-later
-- hearthis.at self-service audio import (artist's own connected hearthisUsername
-- only) — distinct from the existing embed-only HEARTHIS_EMBED, this one
-- actually downloads and re-hosts the artist's own track bytes, same posture
-- as the existing SOUNDCLOUD import.
ALTER TYPE "channel"."ArchiveItemSource" ADD VALUE IF NOT EXISTS 'HEARTHIS';
ALTER TYPE "core"."CloudImportSource" ADD VALUE IF NOT EXISTS 'HEARTHIS';
