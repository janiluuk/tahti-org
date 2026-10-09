-- Members are told when the board opens a motion for voting.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'MOTION_OPENED';
