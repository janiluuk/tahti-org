-- Sprint 9: Bandcamp and SoundCloud OAuth tokens for import flow
ALTER TABLE "core"."User"
  ADD COLUMN "bandcampAccessTokenEnc"   TEXT,
  ADD COLUMN "soundcloudAccessTokenEnc" TEXT;
