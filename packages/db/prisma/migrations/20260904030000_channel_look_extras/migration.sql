-- Channel Designer look extras previously stored only in client localStorage.
ALTER TABLE "channel"."Channel" ADD COLUMN "usePlayerGradient" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "channel"."Channel" ADD COLUMN "playerColorSchemeJson" TEXT;
ALTER TABLE "channel"."Channel" ADD COLUMN "useBackgroundGradient" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "channel"."Channel" ADD COLUMN "backgroundColorSchemeJson" TEXT;
ALTER TABLE "channel"."Channel" ADD COLUMN "backgroundVisualPreset" TEXT;
ALTER TABLE "channel"."Channel" ADD COLUMN "nowPlayingOverlayStyle" TEXT;
ALTER TABLE "channel"."Channel" ADD COLUMN "nowPlayingOverlaySettingsJson" TEXT;
ALTER TABLE "channel"."Channel" ADD COLUMN "playerOverlayMode" "channel"."ChannelTextLayerMode" NOT NULL DEFAULT 'NONE';
ALTER TABLE "channel"."Channel" ADD COLUMN "playerOverlayText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "channel"."Channel" ADD COLUMN "playerOverlayAlign" "channel"."ChannelTextLayerAlign" NOT NULL DEFAULT 'CENTER';
ALTER TABLE "channel"."Channel" ADD COLUMN "channelLinksJson" TEXT;
