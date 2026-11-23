-- Expired-token lookups by expiresAt (auth-row retention).
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "core"."RefreshToken"("expiresAt");
