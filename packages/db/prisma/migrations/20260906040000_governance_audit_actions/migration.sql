-- Governance audit actions for meetings, documents, resolutions, and yearly reports.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MEETING_CREATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MEETING_UPDATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MEETING_ATTENDANCE_UPSERT';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_CREATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'RESOLUTION_CREATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'RESOLUTION_UPDATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ANNUAL_REPORT_GENERATE';
