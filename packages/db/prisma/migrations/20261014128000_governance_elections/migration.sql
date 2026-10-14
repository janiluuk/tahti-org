-- Board elections: the role, the seats and when nominations close.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ELECTION_CREATE';

CREATE TABLE "governance"."GovernanceElection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "role" "governance"."GovernanceBoardRole" NOT NULL,
    "seats" INTEGER NOT NULL,
    "meetingId" TEXT,
    "nominationsCloseAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceElection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceElection_createdAt_idx" ON "governance"."GovernanceElection"("createdAt");

ALTER TABLE "governance"."GovernanceElection" ADD CONSTRAINT "GovernanceElection_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
