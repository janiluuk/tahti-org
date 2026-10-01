-- AlterTable
ALTER TABLE "channel"."Channel" ADD COLUMN     "nextBroadcastDurationHours" INTEGER,
ADD COLUMN     "nextBroadcastShowId" TEXT;

-- AddForeignKey
ALTER TABLE "channel"."Channel" ADD CONSTRAINT "Channel_nextBroadcastShowId_fkey" FOREIGN KEY ("nextBroadcastShowId") REFERENCES "channel"."LiveShowSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

