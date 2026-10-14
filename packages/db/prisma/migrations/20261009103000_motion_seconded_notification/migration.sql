-- The proposer is told when a member seconds their motion draft.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'MOTION_SECONDED';
