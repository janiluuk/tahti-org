-- AlterTable
ALTER TABLE "chat"."ChatMessage" ADD COLUMN "removedAt" TIMESTAMP(3),
ADD COLUMN "removedByUserId" TEXT;
