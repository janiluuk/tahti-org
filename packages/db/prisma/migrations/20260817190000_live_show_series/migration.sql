-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Reusable live-show series and concrete scheduled episodes.

CREATE TABLE "channel"."LiveShowSeries" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tagline" TEXT,
    "showType" "channel"."BroadcastShowType" NOT NULL DEFAULT 'LIVE_SET',
    "visibility" "channel"."BroadcastVisibility" NOT NULL DEFAULT 'PUBLIC',
    "autoArchive" BOOLEAN NOT NULL DEFAULT true,
    "episodeNumberEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nextEpisodeNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiveShowSeries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel"."ScheduledLiveShow" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "episodeNumber" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tagline" TEXT,
    "showType" "channel"."BroadcastShowType" NOT NULL,
    "visibility" "channel"."BroadcastVisibility" NOT NULL,
    "autoArchive" BOOLEAN NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduledLiveShow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "channel"."Broadcast" ADD COLUMN "description" TEXT;
ALTER TABLE "channel"."Broadcast" ADD COLUMN "scheduledLiveShowId" TEXT;

CREATE INDEX "LiveShowSeries_channelId_createdAt_idx" ON "channel"."LiveShowSeries"("channelId", "createdAt" DESC);
CREATE INDEX "ScheduledLiveShow_channelId_startAt_idx" ON "channel"."ScheduledLiveShow"("channelId", "startAt");
CREATE INDEX "ScheduledLiveShow_seriesId_startAt_idx" ON "channel"."ScheduledLiveShow"("seriesId", "startAt");
CREATE UNIQUE INDEX "Broadcast_scheduledLiveShowId_key" ON "channel"."Broadcast"("scheduledLiveShowId");

ALTER TABLE "channel"."LiveShowSeries" ADD CONSTRAINT "LiveShowSeries_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel"."ScheduledLiveShow" ADD CONSTRAINT "ScheduledLiveShow_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel"."ScheduledLiveShow" ADD CONSTRAINT "ScheduledLiveShow_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "channel"."LiveShowSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel"."Broadcast" ADD CONSTRAINT "Broadcast_scheduledLiveShowId_fkey" FOREIGN KEY ("scheduledLiveShowId") REFERENCES "channel"."ScheduledLiveShow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
