-- CreateTable
CREATE TABLE "channel"."ListeningParty" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "hostNote" TEXT,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningParty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListeningParty_channelId_startAt_idx" ON "channel"."ListeningParty"("channelId", "startAt");

-- CreateIndex
CREATE INDEX "ListeningParty_releaseId_idx" ON "channel"."ListeningParty"("releaseId");

-- AddForeignKey
ALTER TABLE "channel"."ListeningParty" ADD CONSTRAINT "ListeningParty_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "release"."Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."ListeningParty" ADD CONSTRAINT "ListeningParty_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel"."ListeningParty" ADD CONSTRAINT "ListeningParty_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
