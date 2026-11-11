DO $$ BEGIN
  CREATE TYPE "core"."ArtistEventVisibility" AS ENUM ('PUBLIC', 'FANS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "core"."ArtistEvent" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
ALTER TABLE "core"."ArtistEvent" ADD COLUMN IF NOT EXISTS "venueId" TEXT;
ALTER TABLE "core"."ArtistEvent" ADD COLUMN IF NOT EXISTS "visibility" "core"."ArtistEventVisibility" NOT NULL DEFAULT 'PUBLIC';

CREATE INDEX IF NOT EXISTS "ArtistEvent_venueId_idx" ON "core"."ArtistEvent"("venueId");

DO $$ BEGIN
  ALTER TABLE "core"."ArtistEvent" ADD CONSTRAINT "ArtistEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venue"."Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
