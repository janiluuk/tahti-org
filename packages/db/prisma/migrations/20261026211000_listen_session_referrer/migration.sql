-- Host a listener came from, host only, for Studio audience stats.
ALTER TABLE "engagement"."ListenSession" ADD COLUMN "referrerHost" TEXT;
