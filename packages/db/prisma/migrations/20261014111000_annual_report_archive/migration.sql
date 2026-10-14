-- The board can archive an annual report.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ANNUAL_REPORT_ARCHIVE';

ALTER TABLE "admin"."AnnualReport" ADD COLUMN "archivedAt" TIMESTAMP(3);
