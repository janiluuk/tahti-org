ALTER TYPE "channel"."BroadcastVisibility" ADD VALUE IF NOT EXISTS 'PRIVATE';

ALTER TABLE "channel"."Broadcast" ADD COLUMN IF NOT EXISTS "ingestDisconnectedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "channel"."BroadcastShowDraft" (
    "channelId" TEXT NOT NULL,
    "title" TEXT,
    "tagline" TEXT,
    "showType" "channel"."BroadcastShowType",
    "visibility" "channel"."BroadcastVisibility",
    "autoPublish" BOOLEAN,
    "seriesId" TEXT,
    "artworkUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastShowDraft_pkey" PRIMARY KEY ("channelId")
);

CREATE INDEX IF NOT EXISTS "BroadcastShowDraft_seriesId_idx" ON "channel"."BroadcastShowDraft"("seriesId");

DO $$ BEGIN
  ALTER TABLE "channel"."BroadcastShowDraft"
    ADD CONSTRAINT "BroadcastShowDraft_channelId_fkey" FOREIGN KEY ("channelId")
    REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "channel"."BroadcastShowDraft"
    ADD CONSTRAINT "BroadcastShowDraft_seriesId_fkey" FOREIGN KEY ("seriesId")
    REFERENCES "channel"."LiveShowSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
