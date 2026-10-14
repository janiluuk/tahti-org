-- The board can put a board resolution under a legal hold.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'RESOLUTION_LEGAL_HOLD';

ALTER TABLE "admin"."BoardResolution" ADD COLUMN "legalHoldAt" TIMESTAMP(3),
ADD COLUMN "legalHoldReason" TEXT;
