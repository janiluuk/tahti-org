-- Board edits to the artwork presets are audited.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ARTWORK_PRESET_CREATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ARTWORK_PRESET_UPDATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ARTWORK_PRESET_DELETE';
