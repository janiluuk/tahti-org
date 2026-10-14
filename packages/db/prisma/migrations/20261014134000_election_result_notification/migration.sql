-- Candidates are told the result of their election.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'ELECTION_RESULT';
