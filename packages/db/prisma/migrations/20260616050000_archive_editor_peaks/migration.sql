-- PERF-04: precomputed editor peak pyramid on ingest
ALTER TABLE "channel"."ArchiveItem" ADD COLUMN "editorPeaks" JSONB;

-- SEC-08: audit publish-to-release from editor
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ARCHIVE_EDIT_PUBLISH';
