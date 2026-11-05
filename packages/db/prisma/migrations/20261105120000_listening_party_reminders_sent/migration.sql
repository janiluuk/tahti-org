-- When the "starting now" reminders went out.
ALTER TABLE "channel"."ListeningParty" ADD COLUMN "remindersSentAt" TIMESTAMP(3);
