-- Track lists count counted downloads per sound; the partial index makes
-- those index-only counts.
-- Raw SQL only: Prisma 5.22 @@index cannot express a partial (WHERE) index,
-- so it is not in schema.prisma. Prisma 5.22 skips partial indexes when diffing,
-- so `migrate dev` does not drop it; if a newer Prisma generates a DROP for it,
-- delete that line (docs/technical/db-audit-2026-11-22.md).
-- CONCURRENTLY cannot run in a transaction, and Prisma runs a multi-statement
-- file as one, so this migration holds exactly one statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Download_counted_soundId_idx" ON "engagement"."Download"("soundId") WHERE "countedAt" IS NOT NULL;
