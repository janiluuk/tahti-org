-- Members are told when a board election takes nominations.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'ELECTION_OPENED';
