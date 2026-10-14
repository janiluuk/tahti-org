-- A motion can name the agenda item that takes it up.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MOTION_AGENDA_LINK';

ALTER TABLE "governance"."Motion" ADD COLUMN "agendaItemId" TEXT;

CREATE INDEX "Motion_agendaItemId_idx" ON "governance"."Motion"("agendaItemId");

ALTER TABLE "governance"."Motion" ADD CONSTRAINT "Motion_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "governance"."GovernanceAgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
