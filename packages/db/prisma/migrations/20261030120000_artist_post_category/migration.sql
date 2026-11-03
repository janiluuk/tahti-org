-- CreateEnum
CREATE TYPE "core"."ArtistPostCategory" AS ENUM ('STORY', 'NEWS', 'ANNOUNCEMENT');

-- AlterTable
ALTER TABLE "core"."ArtistPost" ADD COLUMN "category" "core"."ArtistPostCategory" NOT NULL DEFAULT 'STORY';

-- CreateIndex
CREATE INDEX "ArtistPost_publishAt_id_idx" ON "core"."ArtistPost"("publishAt" DESC, "id" DESC);
