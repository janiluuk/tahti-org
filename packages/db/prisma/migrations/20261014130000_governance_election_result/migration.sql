-- The board records who an election elected; each gets a board term.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ELECTION_DECIDE';

ALTER TABLE "governance"."GovernanceElectionCandidate" ADD COLUMN "elected" BOOLEAN NOT NULL DEFAULT false;
