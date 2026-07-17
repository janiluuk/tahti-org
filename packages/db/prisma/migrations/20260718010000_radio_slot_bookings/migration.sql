-- Tahti Radio slot booking: logged-in artists reserve an hourly window (2h max)
-- to play a live set on the shared Tahti Radio channel.

CREATE TABLE "channel"."RadioSlotBooking" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RadioSlotBooking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RadioSlotBooking_startAt_endAt_idx" ON "channel"."RadioSlotBooking"("startAt", "endAt");
CREATE INDEX "RadioSlotBooking_channelId_startAt_idx" ON "channel"."RadioSlotBooking"("channelId", "startAt");

ALTER TABLE "channel"."RadioSlotBooking"
  ADD CONSTRAINT "RadioSlotBooking_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
