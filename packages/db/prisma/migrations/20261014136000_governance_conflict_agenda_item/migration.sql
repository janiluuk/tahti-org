-- A conflict-of-interest declaration can name the agenda item it concerns.
ALTER TABLE "governance"."GovernanceConflictDeclaration" ADD COLUMN "agendaItemId" TEXT;

CREATE INDEX "GovernanceConflictDeclaration_agendaItemId_idx" ON "governance"."GovernanceConflictDeclaration"("agendaItemId");

ALTER TABLE "governance"."GovernanceConflictDeclaration" ADD CONSTRAINT "GovernanceConflictDeclaration_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "governance"."GovernanceAgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
