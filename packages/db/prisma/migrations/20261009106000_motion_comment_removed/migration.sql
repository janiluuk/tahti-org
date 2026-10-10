-- A motion comment can be removed; the row stays so the thread keeps its shape.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MOTION_COMMENT_REMOVE';

ALTER TABLE "governance"."MotionComment" ADD COLUMN "removedAt" TIMESTAMP(3);
ALTER TABLE "governance"."MotionComment" ADD COLUMN "removedById" TEXT;
