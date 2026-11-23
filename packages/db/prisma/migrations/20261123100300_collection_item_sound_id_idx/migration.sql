-- "In collections" on a track and the SetNull on Sound delete look up by soundId.
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CollectionItem_soundId_idx" ON "media"."CollectionItem"("soundId");
