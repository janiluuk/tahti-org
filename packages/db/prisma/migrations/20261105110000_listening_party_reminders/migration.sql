-- CreateTable
CREATE TABLE "channel"."ListeningPartyReminder" (
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningPartyReminder_pkey" PRIMARY KEY ("partyId","userId")
);

-- CreateIndex
CREATE INDEX "ListeningPartyReminder_userId_idx" ON "channel"."ListeningPartyReminder"("userId");

-- AddForeignKey
ALTER TABLE "channel"."ListeningPartyReminder" ADD CONSTRAINT "ListeningPartyReminder_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "channel"."ListeningParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."ListeningPartyReminder" ADD CONSTRAINT "ListeningPartyReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
