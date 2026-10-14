-- The board can publish an approved annual report to members.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ANNUAL_REPORT_PUBLISH';

ALTER TABLE "admin"."AnnualReport" ADD COLUMN "publishedAt" TIMESTAMP(3);
