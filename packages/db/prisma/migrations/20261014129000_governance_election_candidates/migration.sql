-- Candidates in a board election, nominated by the board or by themselves.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ELECTION_NOMINATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ELECTION_WITHDRAW';

CREATE TABLE "governance"."GovernanceElectionCandidate" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "statement" TEXT,
    "nominatedById" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceElectionCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GovernanceElectionCandidate_electionId_userId_key" ON "governance"."GovernanceElectionCandidate"("electionId", "userId");

ALTER TABLE "governance"."GovernanceElectionCandidate" ADD CONSTRAINT "GovernanceElectionCandidate_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "governance"."GovernanceElection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "governance"."GovernanceElectionCandidate" ADD CONSTRAINT "GovernanceElectionCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
