-- The board can archive a governance document.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_ARCHIVE';

ALTER TABLE "governance"."GovernanceDocument" ADD COLUMN "archivedAt" TIMESTAMP(3);
