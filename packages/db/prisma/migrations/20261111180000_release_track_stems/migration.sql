-- CreateEnum
CREATE TYPE "release"."ReleaseStemRole" AS ENUM ('vocals', 'drums', 'bass', 'other');

-- CreateTable
CREATE TABLE "release"."ReleaseTrackStem" (
    "id" TEXT NOT NULL,
    "releaseTrackId" TEXT NOT NULL,
    "role" "release"."ReleaseStemRole" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "streamKey" TEXT,
    "durationSec" INTEGER,
    "status" "release"."TrackStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseTrackStem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReleaseTrackStem_releaseTrackId_idx" ON "release"."ReleaseTrackStem"("releaseTrackId");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseTrackStem_releaseTrackId_role_key" ON "release"."ReleaseTrackStem"("releaseTrackId", "role");

-- AddForeignKey
ALTER TABLE "release"."ReleaseTrackStem" ADD CONSTRAINT "ReleaseTrackStem_releaseTrackId_fkey" FOREIGN KEY ("releaseTrackId") REFERENCES "release"."ReleaseTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
