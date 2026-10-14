-- The board can put a meeting record under a legal hold.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MEETING_LEGAL_HOLD';

ALTER TABLE "governance"."GovernanceMeeting" ADD COLUMN "legalHoldAt" TIMESTAMP(3),
ADD COLUMN "legalHoldReason" TEXT;
