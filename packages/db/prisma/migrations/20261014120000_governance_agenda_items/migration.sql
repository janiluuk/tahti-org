-- Structured agenda items on a meeting, so decisions can name the item they settle.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'AGENDA_ITEM_CREATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'AGENDA_ITEM_UPDATE';

CREATE TABLE "governance"."GovernanceAgendaItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceAgendaItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceAgendaItem_meetingId_position_idx" ON "governance"."GovernanceAgendaItem"("meetingId", "position");

ALTER TABLE "governance"."GovernanceAgendaItem" ADD CONSTRAINT "GovernanceAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "governance"."GovernanceMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
