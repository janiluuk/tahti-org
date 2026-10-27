-- A discussion post can be removed by its author or the board.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'DISCUSSION_POST_REMOVE';
