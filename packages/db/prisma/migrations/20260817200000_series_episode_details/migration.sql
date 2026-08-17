ALTER TYPE "media"."CollectionStyle" ADD VALUE IF NOT EXISTS 'PODCAST';

ALTER TABLE "channel"."LiveShowSeries"
  ADD COLUMN "artworkUrl" TEXT;

ALTER TABLE "channel"."ScheduledLiveShow"
  ADD COLUMN "venue" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "artworkUrl" TEXT;

ALTER TABLE "channel"."Broadcast"
  ADD COLUMN "artworkUrl" TEXT;
