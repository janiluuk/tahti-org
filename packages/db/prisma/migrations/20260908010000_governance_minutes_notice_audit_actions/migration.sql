-- Distinct audit actions for minutes-workflow steps and meeting-notice publication,
-- so PATCH /meetings/:id stops collapsing them into the generic MEETING_UPDATE row.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MINUTES_UPLOAD';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MINUTES_APPROVE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MINUTES_SIGN';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MEETING_NOTICE_PUBLISH';
