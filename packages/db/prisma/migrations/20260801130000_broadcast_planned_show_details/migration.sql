-- When going live for a booked Tahti Radio slot, preflight can auto-fill
-- episode number + editable tagline and link the session to that booking.
ALTER TABLE "channel"."Broadcast" ADD COLUMN "episodeNumber" INTEGER;
ALTER TABLE "channel"."Broadcast" ADD COLUMN "tagline" TEXT;
ALTER TABLE "channel"."Broadcast" ADD COLUMN "radioSlotBookingId" TEXT;

ALTER TABLE "channel"."Broadcast"
  ADD CONSTRAINT "Broadcast_radioSlotBookingId_fkey"
  FOREIGN KEY ("radioSlotBookingId") REFERENCES "channel"."RadioSlotBooking"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Broadcast_radioSlotBookingId_idx" ON "channel"."Broadcast"("radioSlotBookingId");
