-- AlterTable
ALTER TABLE "channel"."Channel" ADD COLUMN "streamOverlayBackdropUrl" TEXT;
ALTER TABLE "channel"."Channel" ADD COLUMN "streamOverlayVisualPreset" "channel"."VisualPreset" NOT NULL DEFAULT 'MINIMAL';
