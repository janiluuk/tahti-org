-- Preserve the original upload's technical audio profile for the artist editor.
ALTER TABLE "channel"."ArchiveItem"
  ADD COLUMN "sourceSampleRateHz" INTEGER,
  ADD COLUMN "sourceBitDepth" INTEGER,
  ADD COLUMN "sourceChannels" INTEGER;

ALTER TABLE "channel"."ArchiveItemVersion"
  ADD COLUMN "sourceSampleRateHz" INTEGER,
  ADD COLUMN "sourceBitDepth" INTEGER,
  ADD COLUMN "sourceChannels" INTEGER;
