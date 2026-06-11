-- Detected source format/bitrate for archive uploads — used to avoid
-- upscaling/downscaling lossy audio and to display source quality to artists.

ALTER TABLE "channel"."ArchiveItem"
  ADD COLUMN "sourceFormat"      TEXT,
  ADD COLUMN "sourceBitrateKbps" INTEGER;

ALTER TABLE "channel"."ArchiveItemVersion"
  ADD COLUMN "sourceFormat"      TEXT,
  ADD COLUMN "sourceBitrateKbps" INTEGER;
