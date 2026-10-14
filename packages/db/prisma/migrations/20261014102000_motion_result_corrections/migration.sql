-- The board can add an append-only correction to a motion's certified result.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MOTION_RESULT_CORRECT';

CREATE TABLE "governance"."MotionResultCorrection" (
    "id" TEXT NOT NULL,
    "motionId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "tally" JSONB,
    "digest" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotionResultCorrection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MotionResultCorrection_motionId_createdAt_idx" ON "governance"."MotionResultCorrection"("motionId", "createdAt");

ALTER TABLE "governance"."MotionResultCorrection" ADD CONSTRAINT "MotionResultCorrection_motionId_fkey" FOREIGN KEY ("motionId") REFERENCES "governance"."Motion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "governance"."MotionResultCorrection" ADD CONSTRAINT "MotionResultCorrection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
