-- AlterEnum
ALTER TYPE "governance"."AuditAction" ADD VALUE 'CONFLICT_DECLARE';

-- CreateTable
CREATE TABLE "governance"."GovernanceConflictDeclaration" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT,
    "displayName" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "recused" BOOLEAN NOT NULL DEFAULT true,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceConflictDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GovernanceConflictDeclaration_meetingId_idx" ON "governance"."GovernanceConflictDeclaration"("meetingId");

-- AddForeignKey
ALTER TABLE "governance"."GovernanceConflictDeclaration" ADD CONSTRAINT "GovernanceConflictDeclaration_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."GovernanceConflictDeclaration" ADD CONSTRAINT "GovernanceConflictDeclaration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

