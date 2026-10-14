-- The board can edit a governance document's own fields.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_UPDATE';
