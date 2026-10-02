-- Artists are told about comments on their tracks and channel.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'NEW_COMMENT';
