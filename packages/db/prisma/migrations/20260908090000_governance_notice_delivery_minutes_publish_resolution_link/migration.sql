-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "governance"."AuditAction" ADD VALUE 'MINUTES_REDACT';
ALTER TYPE "governance"."AuditAction" ADD VALUE 'MINUTES_PUBLISH';
ALTER TYPE "governance"."AuditAction" ADD VALUE 'MEETING_NOTICE_SEND';

-- AlterTable
ALTER TABLE "admin"."BoardResolution" ADD COLUMN     "binding" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "meetingId" TEXT;

-- AlterTable
ALTER TABLE "governance"."GovernanceMeeting" ADD COLUMN     "minutesPublishedAt" TIMESTAMP(3),
ADD COLUMN     "minutesRedacted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "governance"."GovernanceNoticeDelivery" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bouncedAt" TIMESTAMP(3),

    CONSTRAINT "GovernanceNoticeDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GovernanceNoticeDelivery_meetingId_idx" ON "governance"."GovernanceNoticeDelivery"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceNoticeDelivery_meetingId_memberId_key" ON "governance"."GovernanceNoticeDelivery"("meetingId", "memberId");

-- CreateIndex
CREATE INDEX "BoardResolution_meetingId_idx" ON "admin"."BoardResolution"("meetingId");

-- AddForeignKey
ALTER TABLE "governance"."GovernanceNoticeDelivery" ADD CONSTRAINT "GovernanceNoticeDelivery_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."GovernanceNoticeDelivery" ADD CONSTRAINT "GovernanceNoticeDelivery_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."BoardResolution" ADD CONSTRAINT "BoardResolution_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

