-- A member can withdraw a correction request the board has not answered.
ALTER TYPE "governance"."GovernanceCorrectionState" ADD VALUE IF NOT EXISTS 'WITHDRAWN';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'CORRECTION_WITHDRAW';
