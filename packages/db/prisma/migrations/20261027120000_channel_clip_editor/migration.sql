ALTER TABLE "channel"."AnnouncementClip"
  ADD COLUMN "editorSettings" JSONB,
  ADD COLUMN "draftSettings" JSONB,
  ADD COLUMN "draftAudioKey" TEXT,
  ADD COLUMN "draftDurationSec" INTEGER,
  ADD COLUMN "draftStatus" "channel"."AnnouncementRenderStatus",
  ADD COLUMN "renderToken" TEXT,
  ADD COLUMN "placement" TEXT NOT NULL DEFAULT 'BETWEEN',
  ADD COLUMN "targetSoundId" TEXT;
