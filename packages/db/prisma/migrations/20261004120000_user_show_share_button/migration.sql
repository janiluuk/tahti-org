-- Artists can hide the share button on their channel page.
ALTER TABLE "core"."User" ADD COLUMN "showShareButton" BOOLEAN NOT NULL DEFAULT true;
