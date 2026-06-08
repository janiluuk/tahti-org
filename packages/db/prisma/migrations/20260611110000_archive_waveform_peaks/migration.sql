-- M27: per-set waveform visualisation — store bucketed amplitude peaks (0..255) as JSON

ALTER TABLE "channel"."ArchiveItem" ADD COLUMN "peaks" JSONB;
ALTER TABLE "channel"."ArchiveItemVersion" ADD COLUMN "peaks" JSONB;
