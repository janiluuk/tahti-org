-- Followers are told when an artist announces an upcoming event.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'NEW_EVENT';
