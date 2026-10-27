-- The board removed a track or comment of yours.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'CONTENT_REMOVED_BY_BOARD';
