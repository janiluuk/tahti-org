-- Discover "New to you" reads a listener's history by dedupeKey, newest first.
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ListenEvent_dedupeKey_playedAt_idx" ON "engagement"."ListenEvent"("dedupeKey", "playedAt" DESC);
