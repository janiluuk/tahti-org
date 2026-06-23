-- M33: explicit on/off switch for the 24/7 archive rotation, independent of item selection
ALTER TABLE "channel"."Channel" ADD COLUMN "fallbackEnabled" BOOLEAN NOT NULL DEFAULT true;
