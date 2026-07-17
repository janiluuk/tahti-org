-- Commenting on tracks (ArchiveItem) and channels, with per-item on/off toggles
-- and user-level defaults applied when a new item is created.

ALTER TABLE "core"."User" ADD COLUMN "defaultTrackCommentsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "core"."User" ADD COLUMN "defaultChannelCommentsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "channel"."Channel" ADD COLUMN "commentsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "channel"."ArchiveItem" ADD COLUMN "commentsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "engagement"."Comment" (
  "id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "archiveItemId" TEXT,
  "channelId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Comment_archiveItemId_createdAt_idx" ON "engagement"."Comment"("archiveItemId", "createdAt");

CREATE INDEX "Comment_channelId_createdAt_idx" ON "engagement"."Comment"("channelId", "createdAt");

ALTER TABLE "engagement"."Comment"
  ADD CONSTRAINT "Comment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "engagement"."Comment"
  ADD CONSTRAINT "Comment_archiveItemId_fkey"
  FOREIGN KEY ("archiveItemId") REFERENCES "channel"."ArchiveItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "engagement"."Comment"
  ADD CONSTRAINT "Comment_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
