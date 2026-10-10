-- A member is told when the board answers their correction request.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'CORRECTION_RESOLVED';
