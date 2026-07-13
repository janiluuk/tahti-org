ALTER TABLE "channel"."ArchiveItem" ADD COLUMN IF NOT EXISTS "venueId" TEXT;
ALTER TABLE "core"."User" ADD COLUMN IF NOT EXISTS "defaultLocation" TEXT;

ALTER TABLE "channel"."ArchiveItem"
  ADD CONSTRAINT "ArchiveItem_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venue"."Venue"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ArchiveItem_venueId_idx" ON "channel"."ArchiveItem"("venueId");
