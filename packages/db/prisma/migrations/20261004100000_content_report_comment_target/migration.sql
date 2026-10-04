-- Track and channel comments can be reported to the board.
ALTER TYPE "admin"."ContentReportTargetType" ADD VALUE IF NOT EXISTS 'COMMENT';
