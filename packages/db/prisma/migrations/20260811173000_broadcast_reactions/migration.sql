-- Permanent storage for flying-emoji reactions fired during a live broadcast
-- (routes/chat/react.ts, ReactionsOverlay) — previously ephemeral, published
-- only to Centrifugo with no record kept. elapsedSec anchors each reaction
-- to the broadcast's own timeline so it can be replayed at the right moment
-- against the eventual archive recording (Broadcast.archiveItemId).

CREATE TABLE "engagement"."BroadcastReaction" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "elapsedSec" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastReaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BroadcastReaction_broadcastId_elapsedSec_idx" ON "engagement"."BroadcastReaction"("broadcastId", "elapsedSec");

ALTER TABLE "engagement"."BroadcastReaction"
  ADD CONSTRAINT "BroadcastReaction_broadcastId_fkey"
  FOREIGN KEY ("broadcastId") REFERENCES "channel"."Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
