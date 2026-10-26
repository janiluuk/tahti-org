-- The board is told about new support requests and requester follow-ups.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET';
