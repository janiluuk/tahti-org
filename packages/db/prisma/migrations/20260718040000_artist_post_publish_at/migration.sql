-- Scheduled artist posts: publishAt defaults to createdAt for existing rows
-- (so nothing already-live silently disappears or reorders), then defaults
-- to now() for new inserts. Public routes filter publishAt <= now().

ALTER TABLE "core"."ArtistPost" ADD COLUMN "publishAt" TIMESTAMP(3);
UPDATE "core"."ArtistPost" SET "publishAt" = "createdAt" WHERE "publishAt" IS NULL;
ALTER TABLE "core"."ArtistPost" ALTER COLUMN "publishAt" SET NOT NULL;
ALTER TABLE "core"."ArtistPost" ALTER COLUMN "publishAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "ArtistPost_userId_publishAt_idx" ON "core"."ArtistPost"("userId", "publishAt" DESC);
