-- The board circulates a motion draft to members for seconds.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MOTION_CIRCULATE';
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'MOTION_CIRCULATED';

ALTER TABLE "governance"."Motion" ADD COLUMN "circulatedAt" TIMESTAMP(3);
