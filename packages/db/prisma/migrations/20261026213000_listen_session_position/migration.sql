-- Furthest position reached and track length, for the listener loyalty curve.
ALTER TABLE "engagement"."ListenSession" ADD COLUMN "maxPositionSec" INTEGER,
ADD COLUMN "durationSec" INTEGER;
