-- Listen-time tracking, session-based: minutes listened, broken down by
-- source surface and geographic origin. Same no-FK shape as Download
-- (high-volume, channelId/archiveItemId/byUserId are plain scalars, not
-- Prisma relations). Named ListenSession, distinct from the existing
-- ListenEvent (per-day play-count dedup for top-lists ranking).

CREATE TYPE "engagement"."ListenSource" AS ENUM ('CHANNEL_PAGE', 'TAHTI_RADIO', 'ARTIST_PROFILE', 'DISCOVER', 'LIBRARY', 'EMBED', 'OTHER');

CREATE TABLE "engagement"."ListenSession" (
  "id" BIGSERIAL NOT NULL,
  "channelId" TEXT NOT NULL,
  "archiveItemId" TEXT,
  "byUserId" TEXT,
  "byFingerprint" TEXT NOT NULL,
  "byIpHash" TEXT NOT NULL,
  "countryCode" TEXT,
  "source" "engagement"."ListenSource" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),

  CONSTRAINT "ListenSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListenSession_channelId_startedAt_idx" ON "engagement"."ListenSession"("channelId", "startedAt");
CREATE INDEX "ListenSession_archiveItemId_startedAt_idx" ON "engagement"."ListenSession"("archiveItemId", "startedAt");
CREATE INDEX "ListenSession_byUserId_startedAt_idx" ON "engagement"."ListenSession"("byUserId", "startedAt");
CREATE INDEX "ListenSession_source_startedAt_idx" ON "engagement"."ListenSession"("source", "startedAt");
CREATE INDEX "ListenSession_countryCode_startedAt_idx" ON "engagement"."ListenSession"("countryCode", "startedAt");
CREATE INDEX "ListenSession_byFingerprint_channelId_archiveItemId_endedAt_idx" ON "engagement"."ListenSession"("byFingerprint", "channelId", "archiveItemId", "endedAt");
CREATE INDEX "ListenSession_endedAt_idx" ON "engagement"."ListenSession"("endedAt");
