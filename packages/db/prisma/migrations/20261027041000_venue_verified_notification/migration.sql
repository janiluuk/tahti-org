-- The board verified your venue, or took the verification back.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'VENUE_VERIFIED';
