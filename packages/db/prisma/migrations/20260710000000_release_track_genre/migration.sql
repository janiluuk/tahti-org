ALTER TABLE "release"."Release" ADD COLUMN IF NOT EXISTS "genre" TEXT;
ALTER TABLE "release"."Release" ADD COLUMN IF NOT EXISTS "genreCustom" TEXT;
ALTER TABLE "release"."ReleaseTrack" ADD COLUMN IF NOT EXISTS "genre" TEXT;
ALTER TABLE "release"."ReleaseTrack" ADD COLUMN IF NOT EXISTS "genreCustom" TEXT;
