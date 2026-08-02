-- Tahti Radio track submissions (artist → board audit) + rejection notification type
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'RADIO_SUBMISSION_REJECTED';

CREATE TYPE "channel"."RadioSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "channel"."RadioTrackSubmissionBatch" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioTrackSubmissionBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel"."RadioTrackSubmissionItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "archiveItemId" TEXT NOT NULL,
    "positionInBatch" INTEGER NOT NULL,
    "status" "channel"."RadioSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioTrackSubmissionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RadioTrackSubmissionBatch_createdAt_idx" ON "channel"."RadioTrackSubmissionBatch"("createdAt" DESC);
CREATE INDEX "RadioTrackSubmissionBatch_submitterId_createdAt_idx" ON "channel"."RadioTrackSubmissionBatch"("submitterId", "createdAt" DESC);

CREATE INDEX "RadioTrackSubmissionItem_status_createdAt_idx" ON "channel"."RadioTrackSubmissionItem"("status", "createdAt" DESC);
CREATE INDEX "RadioTrackSubmissionItem_archiveItemId_status_idx" ON "channel"."RadioTrackSubmissionItem"("archiveItemId", "status");

CREATE UNIQUE INDEX "RadioTrackSubmissionItem_batchId_archiveItemId_key" ON "channel"."RadioTrackSubmissionItem"("batchId", "archiveItemId");

ALTER TABLE "channel"."RadioTrackSubmissionBatch" ADD CONSTRAINT "RadioTrackSubmissionBatch_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel"."RadioTrackSubmissionBatch" ADD CONSTRAINT "RadioTrackSubmissionBatch_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel"."RadioTrackSubmissionItem" ADD CONSTRAINT "RadioTrackSubmissionItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "channel"."RadioTrackSubmissionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel"."RadioTrackSubmissionItem" ADD CONSTRAINT "RadioTrackSubmissionItem_archiveItemId_fkey" FOREIGN KEY ("archiveItemId") REFERENCES "channel"."ArchiveItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel"."RadioTrackSubmissionItem" ADD CONSTRAINT "RadioTrackSubmissionItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
