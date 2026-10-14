-- The board can place a legal hold on a governance document.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_LEGAL_HOLD';

ALTER TABLE "governance"."GovernanceDocument" ADD COLUMN "legalHoldAt" TIMESTAMP(3),
ADD COLUMN "legalHoldReason" TEXT;
