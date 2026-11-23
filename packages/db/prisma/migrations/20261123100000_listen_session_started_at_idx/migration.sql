-- /metrics listen gauges and admin listening stats filter on startedAt alone.
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ListenSession_startedAt_idx" ON "engagement"."ListenSession"("startedAt");
