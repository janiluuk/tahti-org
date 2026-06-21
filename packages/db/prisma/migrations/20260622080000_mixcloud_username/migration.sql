-- Mixed-source collections brief: Mixcloud catalog browsing is public (no OAuth needed),
-- so we just need the artist's own handle for the "Your tracks" tab — same shape as
-- spotifyArtistId.

ALTER TABLE "core"."User"
  ADD COLUMN "mixcloudUsername" TEXT;
