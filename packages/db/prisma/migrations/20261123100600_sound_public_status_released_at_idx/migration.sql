-- Global newest-public feeds (latest tracks, search, new-to-you) filter
-- isPublic + status and order by releasedAt DESC. A partial index
-- (WHERE "status" = 'READY') would never match: Prisma binds enums as
-- CAST($n::text AS "channel"."SoundStatus"), which is not constant-folded, so
-- the planner cannot prove the predicate. Equality on the leading columns works.
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Sound_isPublic_status_releasedAt_idx" ON "channel"."Sound"("isPublic", "status", "releasedAt" DESC);
