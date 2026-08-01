-- Green room: pre-live backstage with invite-only preview access.

CREATE TYPE "channel"."GreenRoomInvitePool" AS ENUM ('MODERATORS_AND_SUBS', 'SUBS_ONLY', 'MANUAL_ONLY');
CREATE TYPE "channel"."GreenRoomInviteSource" AS ENUM ('MODERATOR', 'FAN_SUB', 'MANUAL');

ALTER TABLE "channel"."Channel"
  ADD COLUMN "greenRoomDefaultEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "greenRoomDefaultInvitePool" "channel"."GreenRoomInvitePool" NOT NULL DEFAULT 'MODERATORS_AND_SUBS';

ALTER TABLE "channel"."Broadcast"
  ADD COLUMN "greenRoomEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "channel"."BroadcastGreenRoomInvite" (
  "id" TEXT NOT NULL,
  "broadcastId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" "channel"."GreenRoomInviteSource" NOT NULL,
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "joinedAt" TIMESTAMP(3),

  CONSTRAINT "BroadcastGreenRoomInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BroadcastGreenRoomInvite_broadcastId_userId_key"
  ON "channel"."BroadcastGreenRoomInvite"("broadcastId", "userId");
CREATE INDEX "BroadcastGreenRoomInvite_broadcastId_idx"
  ON "channel"."BroadcastGreenRoomInvite"("broadcastId");
CREATE INDEX "BroadcastGreenRoomInvite_userId_idx"
  ON "channel"."BroadcastGreenRoomInvite"("userId");

ALTER TABLE "channel"."BroadcastGreenRoomInvite"
  ADD CONSTRAINT "BroadcastGreenRoomInvite_broadcastId_fkey"
  FOREIGN KEY ("broadcastId") REFERENCES "channel"."Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel"."BroadcastGreenRoomInvite"
  ADD CONSTRAINT "BroadcastGreenRoomInvite_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
