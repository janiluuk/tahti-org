-- Add attendance snapshots and quorum configuration without modifying the
-- already-shipped governance-record migration.

CREATE TYPE "governance"."GovernanceAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

ALTER TABLE "governance"."GovernanceMeeting"
  ADD COLUMN "eligibleMemberCount" INTEGER,
  ADD COLUMN "quorumRequired" INTEGER;

CREATE TABLE "governance"."GovernanceAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT,
    "displayName" TEXT NOT NULL,
    "status" "governance"."GovernanceAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GovernanceAttendance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceAttendance_meetingId_status_idx" ON "governance"."GovernanceAttendance"("meetingId", "status");
CREATE UNIQUE INDEX "GovernanceAttendance_meetingId_memberId_key" ON "governance"."GovernanceAttendance"("meetingId", "memberId");

ALTER TABLE "governance"."GovernanceAttendance"
  ADD CONSTRAINT "GovernanceAttendance_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "governance"."GovernanceAttendance"
  ADD CONSTRAINT "GovernanceAttendance_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
