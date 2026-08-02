-- Optional announcement clip used as looping ambient music on the public artist page.
ALTER TABLE "channel"."Channel"
  ADD COLUMN "profileBackgroundClipId" TEXT;

CREATE UNIQUE INDEX "Channel_profileBackgroundClipId_key"
  ON "channel"."Channel"("profileBackgroundClipId");

ALTER TABLE "channel"."Channel"
  ADD CONSTRAINT "Channel_profileBackgroundClipId_fkey"
  FOREIGN KEY ("profileBackgroundClipId") REFERENCES "channel"."AnnouncementClip"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
