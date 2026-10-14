-- Auditors and operations inspectors with their terms.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'AUDITOR_APPOINT';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'AUDITOR_TERM_END';

CREATE TYPE "governance"."GovernanceAuditorKind" AS ENUM ('AUDITOR', 'OPERATIONS_INSPECTOR');

CREATE TABLE "governance"."GovernanceAuditor" (
    "id" TEXT NOT NULL,
    "kind" "governance"."GovernanceAuditorKind" NOT NULL,
    "deputy" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "firm" TEXT,
    "termStart" TIMESTAMP(3) NOT NULL,
    "termEnd" TIMESTAMP(3),
    "meetingId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceAuditor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceAuditor_termStart_idx" ON "governance"."GovernanceAuditor"("termStart");

ALTER TABLE "governance"."GovernanceAuditor" ADD CONSTRAINT "GovernanceAuditor_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
