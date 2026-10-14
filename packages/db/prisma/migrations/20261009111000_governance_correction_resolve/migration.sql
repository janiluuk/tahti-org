-- The board answers a member's correction request.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'CORRECTION_RESOLVE';
