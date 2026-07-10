CREATE TABLE "core"."ArtistEmbed" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "title" TEXT,
  "authorName" TEXT,
  "thumbnailUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArtistEmbed_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "core"."ArtistEmbed"
  ADD CONSTRAINT "ArtistEmbed_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "core"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ArtistEmbed_userId_createdAt_idx" ON "core"."ArtistEmbed"("userId", "createdAt" DESC);
