-- Case-insensitive tag search (discover/search.ts) matches
-- channel.lower_tags("tags") @> ARRAY[lower($1)]; the query must use that exact
-- expression for this index to apply.
-- Raw SQL only: Prisma 5.22 @@index cannot express an expression index, so it
-- is not in schema.prisma. Prisma 5.22 skips expression indexes when diffing, so
-- `migrate dev` does not drop it; if a newer Prisma generates a DROP for it,
-- delete that line (docs/technical/db-audit-2026-11-22.md).
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Sound_lower_tags_idx" ON "channel"."Sound" USING GIN ("channel"."lower_tags"("tags"));
