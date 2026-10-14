-- A governance document can name the version it replaces.
ALTER TABLE "governance"."GovernanceDocument" ADD COLUMN "supersedesId" TEXT;

CREATE UNIQUE INDEX "GovernanceDocument_supersedesId_key" ON "governance"."GovernanceDocument"("supersedesId");

ALTER TABLE "governance"."GovernanceDocument" ADD CONSTRAINT "GovernanceDocument_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "governance"."GovernanceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
