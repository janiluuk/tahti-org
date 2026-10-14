-- A proposer can withdraw their own motion draft.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'MOTION_WITHDRAW';
