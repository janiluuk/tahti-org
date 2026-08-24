-- Theme submission pipeline (personal themes -> admin review -> GitHub PR)
-- and sticky (must-dismiss) notifications, starting with the theme lifecycle.

-- AlterEnum
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'THEME_UNDER_REVIEW';
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'THEME_APPROVED';
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'THEME_REJECTED';
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'ADMIN_TEST';

-- AlterTable
ALTER TABLE "core"."Notification" ADD COLUMN "sticky" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "core"."ThemeVisibility" AS ENUM ('PRIVATE', 'PENDING_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "core"."ThemePrStatus" AS ENUM ('NONE', 'PENDING', 'OPENED', 'ERROR');

-- CreateTable
CREATE TABLE "core"."Theme" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "varsJson" JSONB NOT NULL,
    "darkJson" JSONB NOT NULL,
    "visibility" "core"."ThemeVisibility" NOT NULL DEFAULT 'PRIVATE',
    "moderationNote" TEXT,
    "prStatus" "core"."ThemePrStatus" NOT NULL DEFAULT 'NONE',
    "prUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Theme_userId_idx" ON "core"."Theme"("userId");

-- CreateIndex
CREATE INDEX "Theme_visibility_idx" ON "core"."Theme"("visibility");

-- AddForeignKey
ALTER TABLE "core"."Theme" ADD CONSTRAINT "Theme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
