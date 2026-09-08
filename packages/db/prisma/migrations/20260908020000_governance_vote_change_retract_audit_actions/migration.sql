-- Distinct audit actions for changing or retracting an advisory-motion vote
-- while it is still OPEN (previously a second vote was rejected outright).
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'VOTE_CHANGE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'VOTE_RETRACT';
