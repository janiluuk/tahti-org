-- CreateEnum
CREATE TYPE "channel"."LiveShowEpisodeStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'LIVE');

-- AlterTable
ALTER TABLE "channel"."LiveShowSeries" ADD COLUMN     "intervalHours" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "scheduleNote" TEXT;

-- CreateTable
CREATE TABLE "channel"."LiveShowEpisode" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeNumber" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "artworkUrl" TEXT,
    "status" "channel"."LiveShowEpisodeStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "channel"."ArchiveItemSource" NOT NULL DEFAULT 'UPLOAD',
    "archiveItemId" TEXT,
    "radioSlotBookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveShowEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveShowEpisode_seriesId_episodeNumber_idx" ON "channel"."LiveShowEpisode"("seriesId", "episodeNumber" DESC);

-- CreateIndex
CREATE INDEX "LiveShowEpisode_channelId_createdAt_idx" ON "channel"."LiveShowEpisode"("channelId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "channel"."LiveShowEpisode" ADD CONSTRAINT "LiveShowEpisode_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."LiveShowEpisode" ADD CONSTRAINT "LiveShowEpisode_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "channel"."LiveShowSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."LiveShowEpisode" ADD CONSTRAINT "LiveShowEpisode_archiveItemId_fkey" FOREIGN KEY ("archiveItemId") REFERENCES "channel"."ArchiveItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."LiveShowEpisode" ADD CONSTRAINT "LiveShowEpisode_radioSlotBookingId_fkey" FOREIGN KEY ("radioSlotBookingId") REFERENCES "channel"."RadioSlotBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
