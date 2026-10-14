-- A board resolution can name the agenda item it settles.
ALTER TABLE "admin"."BoardResolution" ADD COLUMN "agendaItemId" TEXT;

CREATE INDEX "BoardResolution_agendaItemId_idx" ON "admin"."BoardResolution"("agendaItemId");

ALTER TABLE "admin"."BoardResolution" ADD CONSTRAINT "BoardResolution_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "governance"."GovernanceAgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
