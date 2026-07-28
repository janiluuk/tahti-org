-- A channel's previous <slug>.tahti.live address stays reserved and
-- redirects to the channel's current slug for 30 days after a rename.

CREATE TABLE "channel"."ChannelSlugRedirect" (
  "id" TEXT NOT NULL,
  "oldSlug" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChannelSlugRedirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelSlugRedirect_oldSlug_key" ON "channel"."ChannelSlugRedirect"("oldSlug");
CREATE INDEX "ChannelSlugRedirect_channelId_idx" ON "channel"."ChannelSlugRedirect"("channelId");

ALTER TABLE "channel"."ChannelSlugRedirect"
  ADD CONSTRAINT "ChannelSlugRedirect_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
