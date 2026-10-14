-- A governance document can name the agenda item it belongs to.
ALTER TABLE "governance"."GovernanceDocument" ADD COLUMN "agendaItemId" TEXT;

CREATE INDEX "GovernanceDocument_agendaItemId_idx" ON "governance"."GovernanceDocument"("agendaItemId");

ALTER TABLE "governance"."GovernanceDocument" ADD CONSTRAINT "GovernanceDocument_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "governance"."GovernanceAgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
