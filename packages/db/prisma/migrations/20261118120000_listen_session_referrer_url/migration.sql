-- Full referrer URL for Studio audience stats (host column kept).
ALTER TABLE "engagement"."ListenSession" ADD COLUMN "referrerUrl" TEXT;
