-- Artists can switch downloads off per track. Defaults to true so existing
-- tracks stay downloadable.
ALTER TABLE "channel"."Sound" ADD COLUMN     "downloadsEnabled" BOOLEAN NOT NULL DEFAULT true;
