-- Highest track position announced in chat (worker idempotency).
ALTER TABLE "channel"."ListeningParty" ADD COLUMN "announcedPosition" INTEGER;
