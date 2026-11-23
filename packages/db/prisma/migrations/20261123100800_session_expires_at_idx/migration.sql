-- The auth-row retention sweep deletes expired sessions by expiresAt.
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_expiresAt_idx" ON "core"."Session"("expiresAt");
