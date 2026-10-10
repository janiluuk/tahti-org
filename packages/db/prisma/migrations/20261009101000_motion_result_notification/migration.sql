-- Members are told the tally when the board closes a motion.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'MOTION_RESULT';
