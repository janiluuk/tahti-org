-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_username_idx" ON "core"."User" USING GIN ("username" "public".gin_trgm_ops);
