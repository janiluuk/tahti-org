-- Data export and the unused-media scan read a user's messages.
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_userId_createdAt_idx" ON "chat"."ChatMessage"("userId", "createdAt");
