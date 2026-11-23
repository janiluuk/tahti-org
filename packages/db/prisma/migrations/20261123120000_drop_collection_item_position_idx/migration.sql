-- Exact duplicate of the CollectionItem_collectionId_position_key unique index,
-- rewritten on every reorder.
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
DROP INDEX CONCURRENTLY IF EXISTS "media"."CollectionItem_collectionId_position_idx";
