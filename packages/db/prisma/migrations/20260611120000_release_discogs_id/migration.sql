-- M30: guided Discogs database submission — store the artist-entered release ID

ALTER TABLE "release"."Release" ADD COLUMN "discogsReleaseId" TEXT;
