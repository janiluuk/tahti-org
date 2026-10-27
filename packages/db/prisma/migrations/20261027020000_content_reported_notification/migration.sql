-- The board is told about new content reports.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'CONTENT_REPORTED';
