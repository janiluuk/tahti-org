CREATE TYPE "core"."ArtistEventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

ALTER TABLE "core"."ArtistEvent"
  ADD COLUMN "ticketUrl" TEXT,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "endAt" TIMESTAMP(3),
  ADD COLUMN "status" "core"."ArtistEventStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "publishedAt" TIMESTAMP(3);

UPDATE "core"."ArtistEvent" SET "publishedAt" = "createdAt";

CREATE INDEX "ArtistEvent_status_startAt_idx" ON "core"."ArtistEvent"("status", "startAt");
