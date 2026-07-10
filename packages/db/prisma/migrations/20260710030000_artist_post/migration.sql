CREATE TABLE "core"."ArtistPost" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArtistPost_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "core"."ArtistPost"
  ADD CONSTRAINT "ArtistPost_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "core"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ArtistPost_userId_createdAt_idx" ON "core"."ArtistPost"("userId", "createdAt" DESC);
