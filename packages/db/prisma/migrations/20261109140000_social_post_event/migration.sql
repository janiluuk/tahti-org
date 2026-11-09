ALTER TABLE "core"."SocialPost" ADD COLUMN IF NOT EXISTS "eventId" TEXT;

CREATE INDEX IF NOT EXISTS "SocialPost_eventId_idx" ON "core"."SocialPost"("eventId");

DO $$ BEGIN
  ALTER TABLE "core"."SocialPost"
    ADD CONSTRAINT "SocialPost_eventId_fkey" FOREIGN KEY ("eventId")
    REFERENCES "core"."ArtistEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
