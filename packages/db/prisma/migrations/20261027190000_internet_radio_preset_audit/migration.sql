-- Board edits to the internet radio station presets are audited.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'INTERNET_RADIO_PRESET_CREATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'INTERNET_RADIO_PRESET_UPDATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'INTERNET_RADIO_PRESET_DELETE';
