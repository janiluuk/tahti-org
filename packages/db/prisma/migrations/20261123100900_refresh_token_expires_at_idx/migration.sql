-- The auth-row retention sweep deletes expired refresh tokens by expiresAt.
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "core"."RefreshToken"("expiresAt");
