-- Artist-controlled toggle to turn off the live chat panel on their channel
-- (and, for the Tahti Radio system account, the station page) entirely.
ALTER TABLE "core"."User"
  ADD COLUMN "chatEnabled" BOOLEAN NOT NULL DEFAULT true;
