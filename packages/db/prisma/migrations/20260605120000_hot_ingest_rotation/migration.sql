-- ARTIST-002: hot ingest credential rotation grace period

ALTER TABLE "channel"."Channel"
  ADD COLUMN IF NOT EXISTS "rtmpStreamKeyPreviousHash" TEXT,
  ADD COLUMN IF NOT EXISTS "rtmpStreamKeyPreviousExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "liveSourcePassPreviousHash" TEXT,
  ADD COLUMN IF NOT EXISTS "liveSourcePassPreviousExpiresAt" TIMESTAMP(3);
