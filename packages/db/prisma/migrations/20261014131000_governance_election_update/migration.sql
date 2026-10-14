-- The board edits an election's details before the result is recorded.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ELECTION_UPDATE';
