-- Optional artist-controlled attribution footer for release smart links.
ALTER TABLE "channel"."Release" ADD COLUMN "showPoweredByFooter" BOOLEAN NOT NULL DEFAULT false;
