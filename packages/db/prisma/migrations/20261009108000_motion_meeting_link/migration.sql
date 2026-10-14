-- A motion can be linked to the meeting that takes it up.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MOTION_MEETING_LINK';

ALTER TABLE "governance"."Motion" ADD COLUMN "meetingId" TEXT;

CREATE INDEX "Motion_meetingId_idx" ON "governance"."Motion"("meetingId");

ALTER TABLE "governance"."Motion" ADD CONSTRAINT "Motion_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
