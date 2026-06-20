-- PLAT-080/083: Google Drive cloud import tokens + import job tracking

ALTER TABLE "core"."User"
  ADD COLUMN "googleDriveAccessTokenEnc" TEXT,
  ADD COLUMN "googleDriveRefreshTokenEnc" TEXT;

CREATE TYPE "core"."CloudImportSource" AS ENUM ('GOOGLE_DRIVE');

CREATE TYPE "core"."CloudImportStatus" AS ENUM ('QUEUED', 'DOWNLOADING', 'DONE', 'FAILED');

CREATE TABLE "core"."CloudImportJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" "core"."CloudImportSource" NOT NULL,
  "externalFileId" TEXT NOT NULL,
  "fileName" TEXT,
  "archiveItemId" TEXT,
  "status" "core"."CloudImportStatus" NOT NULL DEFAULT 'QUEUED',
  "error" TEXT,
  "bytesTransferred" BIGINT,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "CloudImportJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CloudImportJob_archiveItemId_key" ON "core"."CloudImportJob"("archiveItemId");

CREATE INDEX "CloudImportJob_userId_queuedAt_idx" ON "core"."CloudImportJob"("userId", "queuedAt" DESC);

ALTER TABLE "core"."CloudImportJob"
  ADD CONSTRAINT "CloudImportJob_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core"."CloudImportJob"
  ADD CONSTRAINT "CloudImportJob_archiveItemId_fkey"
  FOREIGN KEY ("archiveItemId") REFERENCES "channel"."ArchiveItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
