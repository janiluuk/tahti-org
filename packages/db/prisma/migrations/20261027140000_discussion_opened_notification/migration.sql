-- The board opened a discussion topic; sent to every other member.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'DISCUSSION_OPENED';
