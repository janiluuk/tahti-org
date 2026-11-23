-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Sound_title_idx" ON "channel"."Sound" USING GIN ("title" "public".gin_trgm_ops);
