-- CreateTable
CREATE TABLE "channel"."ChannelVisualPreset" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelVisualPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelVisualPreset_channelId_idx" ON "channel"."ChannelVisualPreset"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelVisualPreset_channelId_name_key" ON "channel"."ChannelVisualPreset"("channelId", "name");

-- AddForeignKey
ALTER TABLE "channel"."ChannelVisualPreset" ADD CONSTRAINT "ChannelVisualPreset_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
