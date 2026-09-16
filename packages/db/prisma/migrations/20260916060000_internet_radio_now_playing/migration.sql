-- Cached "now playing" scrape for a user's added internet radio stations,
-- refreshed on a cron. Only populated for hosts with a parser implemented.
ALTER TABLE "core"."InternetRadioStation" ADD COLUMN     "currentProgramTitle" TEXT,
ADD COLUMN     "currentProgramArtist" TEXT,
ADD COLUMN     "currentProgramFetchedAt" TIMESTAMP(3);
