-- Public channel metrics visibility (Next 50 slices 14–16).
-- Defaults: followers + total plays on; following / today / yesterday / downloads off.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showPlaysTotal" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showPlaysToday" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showPlaysYesterday" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showDownloads" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User" ALTER COLUMN "showFollowing" SET DEFAULT false;
