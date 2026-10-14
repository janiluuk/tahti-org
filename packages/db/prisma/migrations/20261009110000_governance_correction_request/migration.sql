-- A member can ask for register data or a governance record to be corrected.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'CORRECTION_REQUEST';

CREATE TYPE "governance"."GovernanceCorrectionSubject" AS ENUM ('MEMBER_REGISTER', 'GOVERNANCE_RECORD');

CREATE TYPE "governance"."GovernanceCorrectionState" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED');

CREATE TABLE "governance"."GovernanceCorrectionRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "subject" "governance"."GovernanceCorrectionSubject" NOT NULL,
    "details" TEXT NOT NULL,
    "state" "governance"."GovernanceCorrectionState" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceCorrectionRequest_requesterId_createdAt_idx" ON "governance"."GovernanceCorrectionRequest"("requesterId", "createdAt");

CREATE INDEX "GovernanceCorrectionRequest_state_createdAt_idx" ON "governance"."GovernanceCorrectionRequest"("state", "createdAt");

ALTER TABLE "governance"."GovernanceCorrectionRequest" ADD CONSTRAINT "GovernanceCorrectionRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
