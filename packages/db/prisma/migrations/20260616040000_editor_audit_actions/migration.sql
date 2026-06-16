-- SEC-08: audit log actions for pro editor render/bounce
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ARCHIVE_EDIT_RENDER';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ARCHIVE_EDIT_BOUNCE';
