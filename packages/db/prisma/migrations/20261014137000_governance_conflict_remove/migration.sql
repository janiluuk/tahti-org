-- The board can remove a conflict declaration recorded by mistake.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'CONFLICT_REMOVE';
