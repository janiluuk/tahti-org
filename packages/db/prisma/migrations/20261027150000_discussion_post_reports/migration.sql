-- A member can report a discussion reply to the board.
ALTER TYPE "admin"."ContentReportTargetType" ADD VALUE IF NOT EXISTS 'DISCUSSION_POST';
