-- The board can end a board term early.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'BOARD_TERM_END';
