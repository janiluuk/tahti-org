-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (C) 2026 Tahti ry <https://tahti.live>

-- MusicBrainz OAuth2 connection (profile scope) + remembered publish-time preference.
ALTER TABLE "core"."User"
  ADD COLUMN "musicbrainzAccessTokenEnc" TEXT,
  ADD COLUMN "musicbrainzRefreshTokenEnc" TEXT,
  ADD COLUMN "musicbrainzUsername" TEXT,
  ADD COLUMN "defaultRegisterToMusicbrainz" BOOLEAN;
