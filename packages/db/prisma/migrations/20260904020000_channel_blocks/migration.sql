-- Channel Designer "Brand blocks": an ordered, packed list of placeable
-- blocks (logo, addon) on an artist's public channel page. Row-packing is
-- computed at render time from (position order, width) — see packBlocks in
-- @tahti/shared — not stored as an explicit row/column.

-- CreateEnum
CREATE TYPE "core"."ChannelBlockType" AS ENUM ('LOGO', 'ADDON');

-- CreateEnum
CREATE TYPE "core"."ChannelBlockWidth" AS ENUM ('FULL', 'HALF', 'THIRD');

-- CreateTable
CREATE TABLE "core"."ChannelBlock" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "type" "core"."ChannelBlockType" NOT NULL,
    "width" "core"."ChannelBlockWidth" NOT NULL DEFAULT 'FULL',
    "position" INTEGER NOT NULL DEFAULT 0,
    "configJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelBlock_channelId_position_idx" ON "core"."ChannelBlock"("channelId", "position");

-- AddForeignKey
ALTER TABLE "core"."ChannelBlock" ADD CONSTRAINT "ChannelBlock_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
