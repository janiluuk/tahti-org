-- Artist-controlled visibility toggle for the daily listener count shown
-- at the top of their channel's chat panel, alongside showJoinDate/
-- showFollowers/showFollowing.
ALTER TABLE "core"."User"
  ADD COLUMN "showDailyListeners" BOOLEAN NOT NULL DEFAULT true;
