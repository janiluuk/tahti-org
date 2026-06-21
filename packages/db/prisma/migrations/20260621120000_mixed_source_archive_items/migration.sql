-- Mixed-source collections brief: ArchiveItem source/quality discriminator + Spotify artist link.
-- Spotify search/catalog uses an app-level Client Credentials token (no per-user OAuth);
-- spotifyArtistId is just the resolved catalog ID for the artist's own "Your tracks" tab.

ALTER TABLE "core"."User"
  ADD COLUMN "spotifyArtistId" TEXT;

CREATE TYPE "channel"."ArchiveItemSource" AS ENUM (
  'UPLOAD',
  'BROADCAST',
  'BANDCAMP',
  'SOUNDCLOUD',
  'GOOGLE_DRIVE',
  'MIXCLOUD_RESCUE',
  'SPOTIFY_EMBED',
  'MIXCLOUD_EMBED',
  'URL_EMBED'
);

CREATE TYPE "channel"."ArchiveQualityBadge" AS ENUM ('LOSSLESS', 'TRANSCODED', 'EMBED_ONLY');

CREATE TYPE "channel"."ArchiveEmbedProvider" AS ENUM ('SPOTIFY', 'MIXCLOUD', 'YOUTUBE', 'APPLE', 'GENERIC');

ALTER TABLE "channel"."ArchiveItem"
  ALTER COLUMN "rawKey" DROP NOT NULL,
  ALTER COLUMN "fileSizeBytes" DROP NOT NULL,
  ADD COLUMN "source" "channel"."ArchiveItemSource" NOT NULL DEFAULT 'UPLOAD',
  ADD COLUMN "qualityBadge" "channel"."ArchiveQualityBadge" NOT NULL DEFAULT 'LOSSLESS',
  ADD COLUMN "embedUri" TEXT,
  ADD COLUMN "embedProvider" "channel"."ArchiveEmbedProvider";

-- Backfill: items with a completed Google Drive cloud-import job.
UPDATE "channel"."ArchiveItem" ai
SET "source" = 'GOOGLE_DRIVE'
WHERE EXISTS (
  SELECT 1 FROM "core"."CloudImportJob" cij WHERE cij."archiveItemId" = ai."id"
);

-- Backfill: live-broadcast auto-archive items (archive-broadcast.ts sets contentType=LIVE).
UPDATE "channel"."ArchiveItem"
SET "source" = 'BROADCAST'
WHERE "contentType" = 'LIVE' AND "source" = 'UPLOAD';

-- Backfill: quality badge from existing flacKey presence — the same discriminator the
-- source-quality matrix uses going forward (no flacKey means lossy-only, i.e. transcoded).
UPDATE "channel"."ArchiveItem"
SET "qualityBadge" = CASE WHEN "flacKey" IS NOT NULL THEN 'LOSSLESS' ELSE 'TRANSCODED' END;

-- Embed-only items never carry an audio file or size.
ALTER TABLE "channel"."ArchiveItem"
  ADD CONSTRAINT "ArchiveItem_embed_no_audio_check"
  CHECK (
    "source" NOT IN ('SPOTIFY_EMBED', 'MIXCLOUD_EMBED', 'URL_EMBED')
    OR ("flacKey" IS NULL AND "mp3Key" IS NULL AND "rawKey" IS NULL AND "fileSizeBytes" IS NULL)
  );
