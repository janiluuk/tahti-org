-- The board can approve a generated annual report.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ANNUAL_REPORT_APPROVE';

ALTER TABLE "admin"."AnnualReport" ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedById" TEXT,
ADD COLUMN "approvalMeetingId" TEXT;

ALTER TABLE "admin"."AnnualReport" ADD CONSTRAINT "AnnualReport_approvalMeetingId_fkey" FOREIGN KEY ("approvalMeetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
