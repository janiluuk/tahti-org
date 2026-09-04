-- Content-taxonomy audit follow-up: purely additive, nullable/defaulted columns.
--
-- 1. Sound.mediaKind + imageKey/videoKey: lets a Sound row hold an image or
--    video clip instead of audio, reusing the existing catalog/metadata/
--    collections machinery rather than a parallel model.
-- 2. Sound.tags + ReleaseTrack.tags: free-form labels alongside the existing
--    preset genre/subGenres.
-- 3. ReleaseTrack.subGenres/bpm/musicalKey/mixVersion: metadata parity with
--    Sound, so a track catalogued via a Release doesn't lose these fields.

BEGIN;

CREATE TYPE "channel"."SoundMediaKind" AS ENUM ('AUDIO', 'IMAGE', 'VIDEO');

ALTER TABLE "channel"."Sound"
  ADD COLUMN "mediaKind" "channel"."SoundMediaKind" NOT NULL DEFAULT 'AUDIO',
  ADD COLUMN "imageKey" TEXT,
  ADD COLUMN "videoKey" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "release"."ReleaseTrack"
  ADD COLUMN "subGenres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bpm" INTEGER,
  ADD COLUMN "musicalKey" TEXT,
  ADD COLUMN "mixVersion" TEXT;

COMMIT;
