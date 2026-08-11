-- Permanent chat message storage. Centrifugo's own history is a 1h rolling
-- in-memory buffer (infra/centrifugo.json history_ttl) with no persistence
-- across restarts — this table is the durable source of truth going forward.

CREATE TABLE "chat"."ChatMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "fanOnly" BOOLEAN NOT NULL DEFAULT false,
    "handle" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "userId" TEXT,
    "supporter" BOOLEAN NOT NULL DEFAULT false,
    "channelRole" TEXT,
    "countryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMessage_channelId_fanOnly_createdAt_idx" ON "chat"."ChatMessage"("channelId", "fanOnly", "createdAt");

ALTER TABLE "chat"."ChatMessage" ADD CONSTRAINT "ChatMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
