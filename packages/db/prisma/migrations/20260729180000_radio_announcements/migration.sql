-- Channel rotation announcements (user + system) and the IES spotlight
-- ambient visualizer preset, merged together as the two PRs landed back to
-- back with no migration created for either at merge time.

-- CreateEnum
CREATE TYPE "channel"."AnnouncementScheduleMode" AS ENUM ('AFTER_EVERY', 'EVERY_NTH', 'RANDOM');

-- CreateEnum
CREATE TYPE "channel"."AnnouncementRenderStatus" AS ENUM ('READY', 'PROCESSING', 'ERROR');

-- AlterEnum
ALTER TYPE "channel"."VisualPreset" ADD VALUE 'IES_SPOTLIGHT';

-- AlterTable
ALTER TABLE "channel"."Channel" ADD COLUMN     "announcementsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "channel"."AnnouncementClip" (
    "id" TEXT NOT NULL,
    "channelId" TEXT,
    "title" TEXT NOT NULL,
    "audioKey" TEXT NOT NULL,
    "originalAudioKey" TEXT NOT NULL,
    "durationSec" INTEGER,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduleMode" "channel"."AnnouncementScheduleMode" NOT NULL DEFAULT 'RANDOM',
    "everyNth" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "renderStatus" "channel"."AnnouncementRenderStatus" NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementClip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel"."AnnouncementSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "systemEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnouncementClip_channelId_idx" ON "channel"."AnnouncementClip"("channelId");

-- AddForeignKey
ALTER TABLE "channel"."AnnouncementClip" ADD CONSTRAINT "AnnouncementClip_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
