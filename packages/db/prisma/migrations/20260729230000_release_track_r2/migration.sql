-- Long-term R2 mirror of the original (lossless) release-track upload, on
-- both the version-history table and its "active version" convenience
-- mirror on ReleaseTrack itself.
ALTER TABLE "release"."ReleaseTrack" ADD COLUMN     "r2Key" TEXT,
ADD COLUMN     "r2SizeBytes" INTEGER;

ALTER TABLE "release"."ReleaseTrackVersion" ADD COLUMN     "r2Key" TEXT,
ADD COLUMN     "r2SizeBytes" INTEGER;
