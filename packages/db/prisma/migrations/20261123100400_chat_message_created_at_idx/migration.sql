-- Admin chat KPI and timeseries filter on createdAt alone.
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_createdAt_idx" ON "chat"."ChatMessage"("createdAt");
