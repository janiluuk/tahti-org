-- The board can call an election off, with a reason.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ELECTION_CANCEL';

ALTER TABLE "governance"."GovernanceElection" ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelReason" TEXT;
