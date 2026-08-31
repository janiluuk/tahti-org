-- Persisted meeting and document metadata for the association governance archive.

CREATE TYPE "governance"."GovernanceMeetingType" AS ENUM ('GENERAL', 'EXTRAORDINARY_GENERAL', 'BOARD');
CREATE TYPE "governance"."GovernanceMeetingState" AS ENUM ('DRAFT', 'SCHEDULED', 'HELD', 'MINUTES_DRAFT', 'APPROVED', 'CANCELLED');
CREATE TYPE "governance"."GovernanceDocumentType" AS ENUM ('BYLAWS', 'POLICY', 'MEETING_NOTICE', 'MINUTES', 'ANNUAL_REPORT', 'FINANCIAL_STATEMENT', 'AUDIT_REPORT', 'OTHER');

CREATE TABLE "governance"."GovernanceMeeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "governance"."GovernanceMeetingType" NOT NULL,
    "state" "governance"."GovernanceMeetingState" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "location" TEXT,
    "remoteUrl" TEXT,
    "noticeAt" TIMESTAMP(3),
    "agenda" JSONB,
    "minutesKey" TEXT,
    "minutesApprovedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GovernanceMeeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "governance"."GovernanceDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "governance"."GovernanceDocumentType" NOT NULL,
    "description" TEXT,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "meetingId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GovernanceDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceMeeting_type_scheduledAt_idx" ON "governance"."GovernanceMeeting"("type", "scheduledAt");
CREATE INDEX "GovernanceMeeting_state_scheduledAt_idx" ON "governance"."GovernanceMeeting"("state", "scheduledAt");
CREATE INDEX "GovernanceDocument_type_publishedAt_idx" ON "governance"."GovernanceDocument"("type", "publishedAt");
CREATE INDEX "GovernanceDocument_meetingId_idx" ON "governance"."GovernanceDocument"("meetingId");

ALTER TABLE "governance"."GovernanceMeeting"
  ADD CONSTRAINT "GovernanceMeeting_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "core"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "governance"."GovernanceDocument"
  ADD CONSTRAINT "GovernanceDocument_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "governance"."GovernanceDocument"
  ADD CONSTRAINT "GovernanceDocument_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "core"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
