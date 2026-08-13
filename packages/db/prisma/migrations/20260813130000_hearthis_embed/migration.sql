-- SPDX-License-Identifier: AGPL-3.0-or-later
-- hearthis.at mixed-source collections import (embed-only, same posture as
-- the existing Mixcloud/Spotify embeds — no audio re-hosting).
ALTER TYPE "channel"."ArchiveItemSource" ADD VALUE IF NOT EXISTS 'HEARTHIS_EMBED';
ALTER TYPE "channel"."ArchiveEmbedProvider" ADD VALUE IF NOT EXISTS 'HEARTHIS';
