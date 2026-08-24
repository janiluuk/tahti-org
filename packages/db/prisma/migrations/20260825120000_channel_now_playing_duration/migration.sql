-- Lets a "now playing" caller show remaining time without a second lookup —
-- snapshotted from the source ArchiveItem.durationSec alongside the rest of
-- the nowPlaying* fields, see 20260721010000_channel_now_playing.

ALTER TABLE "channel"."Channel" ADD COLUMN "nowPlayingDurationSec" INTEGER;
