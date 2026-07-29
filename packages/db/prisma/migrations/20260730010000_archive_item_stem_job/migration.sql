-- UVR5-family stem separation for library downloads (auto-expires ~7 days
-- after READY — see worker's sweep-expired-stems cron).
CREATE TYPE "channel"."StemSet" AS ENUM ('TWO_STEM', 'FOUR_STEM');

CREATE TYPE "channel"."StemJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

CREATE TABLE "channel"."ArchiveItemStemJob" (
    "id" TEXT NOT NULL,
    "archiveItemId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "stemSet" "channel"."StemSet" NOT NULL,
    "status" "channel"."StemJobStatus" NOT NULL DEFAULT 'PENDING',
    "vocalsKey" TEXT,
    "instrumentalKey" TEXT,
    "drumsKey" TEXT,
    "bassKey" TEXT,
    "otherKey" TEXT,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveItemStemJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArchiveItemStemJob_expiresAt_idx" ON "channel"."ArchiveItemStemJob"("expiresAt");

CREATE UNIQUE INDEX "ArchiveItemStemJob_archiveItemId_stemSet_key" ON "channel"."ArchiveItemStemJob"("archiveItemId", "stemSet");

ALTER TABLE "channel"."ArchiveItemStemJob" ADD CONSTRAINT "ArchiveItemStemJob_archiveItemId_fkey" FOREIGN KEY ("archiveItemId") REFERENCES "channel"."ArchiveItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
