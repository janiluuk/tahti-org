CREATE TABLE "core"."ArtistEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "place" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "eventUrl" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArtistEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "core"."ArtistEvent"
  ADD CONSTRAINT "ArtistEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "core"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ArtistEvent_userId_startAt_idx" ON "core"."ArtistEvent"("userId", "startAt");
