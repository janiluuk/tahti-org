-- Track page and recorded plays look up the release track by soundId.
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReleaseTrack_soundId_idx" ON "release"."ReleaseTrack"("soundId");
