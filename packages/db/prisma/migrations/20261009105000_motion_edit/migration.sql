-- A proposer can edit their own motion draft.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MOTION_EDIT';
