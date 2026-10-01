-- Followers are told when an artist goes live.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'CHANNEL_LIVE';
