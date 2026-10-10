-- AlterTable
ALTER TABLE "chat"."ChatBan" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "ChatBan_channelId_userId_idx" ON "chat"."ChatBan"("channelId", "userId");
