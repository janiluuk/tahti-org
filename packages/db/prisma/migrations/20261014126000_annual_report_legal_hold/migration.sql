-- The board can put an annual report under a legal hold.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ANNUAL_REPORT_LEGAL_HOLD';

ALTER TABLE "admin"."AnnualReport" ADD COLUMN "legalHoldAt" TIMESTAMP(3),
ADD COLUMN "legalHoldReason" TEXT;
