-- Per-background-preset knobs (speed/intensity/scale/audioReactive), same
-- shape as the existing header visualSettingsJson but for
-- Channel.backgroundVisualPreset (the Backdrop-tab preset system).
ALTER TABLE "channel"."Channel" ADD COLUMN     "backgroundVisualSettingsJson" TEXT;
