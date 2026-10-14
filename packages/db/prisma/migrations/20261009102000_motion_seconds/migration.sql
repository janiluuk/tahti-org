-- Members can second a motion draft.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MOTION_SECOND';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MOTION_SECOND_WITHDRAW';

CREATE TABLE "governance"."MotionSecond" (
    "motionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotionSecond_pkey" PRIMARY KEY ("motionId","userId")
);

CREATE INDEX "MotionSecond_motionId_idx" ON "governance"."MotionSecond"("motionId");

ALTER TABLE "governance"."MotionSecond" ADD CONSTRAINT "MotionSecond_motionId_fkey" FOREIGN KEY ("motionId") REFERENCES "governance"."Motion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "governance"."MotionSecond" ADD CONSTRAINT "MotionSecond_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
