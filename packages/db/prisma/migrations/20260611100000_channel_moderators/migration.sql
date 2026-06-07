-- M27: delegate chat moderation (ban/unban) to trusted listeners

CREATE TABLE "chat"."ChannelModerator" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelModerator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelModerator_channelId_userId_key" ON "chat"."ChannelModerator"("channelId", "userId");
CREATE INDEX "ChannelModerator_userId_idx" ON "chat"."ChannelModerator"("userId");

ALTER TABLE "chat"."ChannelModerator" ADD CONSTRAINT "ChannelModerator_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat"."ChannelModerator" ADD CONSTRAINT "ChannelModerator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
