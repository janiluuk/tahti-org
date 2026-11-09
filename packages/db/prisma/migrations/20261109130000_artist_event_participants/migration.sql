ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'EVENT_TAGGED';

CREATE TYPE "core"."ArtistEventParticipantRole" AS ENUM ('PERFORMER', 'HOST', 'GUEST');
CREATE TYPE "core"."ArtistEventParticipantStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "core"."ArtistEventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "core"."ArtistEventParticipantRole" NOT NULL DEFAULT 'PERFORMER',
    "status" "core"."ArtistEventParticipantStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArtistEventParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArtistEventParticipant_eventId_userId_key" ON "core"."ArtistEventParticipant"("eventId", "userId");
CREATE INDEX "ArtistEventParticipant_userId_status_idx" ON "core"."ArtistEventParticipant"("userId", "status");

ALTER TABLE "core"."ArtistEventParticipant" ADD CONSTRAINT "ArtistEventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "core"."ArtistEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core"."ArtistEventParticipant" ADD CONSTRAINT "ArtistEventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
