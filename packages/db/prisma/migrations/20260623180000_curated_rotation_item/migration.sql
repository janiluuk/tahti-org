-- Tahti Selects: curated, admin-programmed rotation referencing ArchiveItems
-- across channels without duplicating audio (see docs/planning-decisions.md).
CREATE TABLE "channel"."CuratedRotationItem" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "archiveItemId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "addedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CuratedRotationItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CuratedRotationItem_channelId_archiveItemId_key" ON "channel"."CuratedRotationItem"("channelId", "archiveItemId");

CREATE INDEX "CuratedRotationItem_channelId_position_idx" ON "channel"."CuratedRotationItem"("channelId", "position");

ALTER TABLE "channel"."CuratedRotationItem"
  ADD CONSTRAINT "CuratedRotationItem_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel"."CuratedRotationItem"
  ADD CONSTRAINT "CuratedRotationItem_archiveItemId_fkey"
  FOREIGN KEY ("archiveItemId") REFERENCES "channel"."ArchiveItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel"."CuratedRotationItem"
  ADD CONSTRAINT "CuratedRotationItem_addedById_fkey"
  FOREIGN KEY ("addedById") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
