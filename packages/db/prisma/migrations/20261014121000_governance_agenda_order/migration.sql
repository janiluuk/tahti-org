-- The board can reorder and remove agenda items.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'AGENDA_ITEM_REMOVE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'AGENDA_ITEM_REORDER';
