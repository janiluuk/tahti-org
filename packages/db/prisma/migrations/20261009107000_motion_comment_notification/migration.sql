-- The proposer is told when a member comments on their motion.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'MOTION_COMMENT';
