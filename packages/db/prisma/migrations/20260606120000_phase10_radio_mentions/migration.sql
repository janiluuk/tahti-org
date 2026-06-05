-- M16: Tahti Radio rotation persistence + M15 public mentions opt-in

ALTER TABLE "channel"."Channel" ADD COLUMN "lastFeaturedAt" TIMESTAMP(3);

ALTER TABLE "core"."User" ADD COLUMN "publicMentionsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "channel"."RadioFeatureLog" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "featuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioFeatureLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RadioFeatureLog_featuredAt_idx" ON "channel"."RadioFeatureLog"("featuredAt" DESC);

ALTER TABLE "channel"."RadioFeatureLog" ADD CONSTRAINT "RadioFeatureLog_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
