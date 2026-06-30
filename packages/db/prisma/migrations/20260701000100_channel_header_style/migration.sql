-- Channel designer Visual section: brand-accent gradient presets + header banner style
-- (docs/reference-html/08-channel-designer.html). Video loop reuses Channel.videoBackgroundUrl.
CREATE TYPE "channel"."ChannelHeaderStyle" AS ENUM ('GRADIENT', 'SOLID', 'VIDEO_LOOP');

ALTER TABLE "channel"."Channel" ADD COLUMN "headerStyle" "channel"."ChannelHeaderStyle" NOT NULL DEFAULT 'GRADIENT';
ALTER TABLE "channel"."Channel" ADD COLUMN "brandAccentPreset" TEXT;
