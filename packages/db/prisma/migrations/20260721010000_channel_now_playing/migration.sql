-- STREAM-012: rotation now-playing. The orchestrator polls each running
-- channel's Liquidsoap telnet metadata and resolves the current track's
-- ArchiveItem onto these fields — only meaningful while no live artist is
-- on air (a live show's identity/artwork comes from the booking instead).

ALTER TABLE "channel"."Channel" ADD COLUMN "nowPlayingTitle" TEXT;
ALTER TABLE "channel"."Channel" ADD COLUMN "nowPlayingArtistName" TEXT;
ALTER TABLE "channel"."Channel" ADD COLUMN "nowPlayingArtworkUrl" TEXT;
ALTER TABLE "channel"."Channel" ADD COLUMN "nowPlayingUpdatedAt" TIMESTAMP(3);
