-- The board can record when an annual report was filed and its reference.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ANNUAL_REPORT_FILE';

ALTER TABLE "admin"."AnnualReport" ADD COLUMN "filedAt" TIMESTAMP(3),
ADD COLUMN "filingReference" TEXT;
