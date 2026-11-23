-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Collection_name_idx" ON "media"."Collection" USING GIN ("name" "public".gin_trgm_ops);
