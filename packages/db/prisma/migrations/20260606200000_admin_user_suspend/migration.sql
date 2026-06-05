-- M21-B: account suspension + audit action extensions

ALTER TABLE "core"."User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "core"."User" ADD COLUMN "suspendReason" TEXT;

ALTER TYPE "governance"."AuditAction" ADD VALUE 'USER_SUSPEND';
ALTER TYPE "governance"."AuditAction" ADD VALUE 'USER_UNSUSPEND';
ALTER TYPE "governance"."AuditAction" ADD VALUE 'BOARD_ROLE_CHANGE';
ALTER TYPE "governance"."AuditAction" ADD VALUE 'ENGAGEMENT_ADJUSTMENT';
ALTER TYPE "governance"."AuditAction" ADD VALUE 'STREAM_FORCE_OFFLINE';
