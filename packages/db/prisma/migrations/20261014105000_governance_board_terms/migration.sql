-- Board members' elected roles and terms.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'BOARD_TERM_RECORD';

CREATE TYPE "governance"."GovernanceBoardRole" AS ENUM ('CHAIR', 'VICE_CHAIR', 'SECRETARY', 'TREASURER', 'MEMBER', 'DEPUTY');

CREATE TABLE "governance"."GovernanceBoardTerm" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "role" "governance"."GovernanceBoardRole" NOT NULL,
    "termStart" TIMESTAMP(3) NOT NULL,
    "termEnd" TIMESTAMP(3),
    "endReason" TEXT,
    "meetingId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceBoardTerm_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceBoardTerm_termStart_idx" ON "governance"."GovernanceBoardTerm"("termStart");

CREATE INDEX "GovernanceBoardTerm_userId_idx" ON "governance"."GovernanceBoardTerm"("userId");

ALTER TABLE "governance"."GovernanceBoardTerm" ADD CONSTRAINT "GovernanceBoardTerm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "governance"."GovernanceBoardTerm" ADD CONSTRAINT "GovernanceBoardTerm_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
