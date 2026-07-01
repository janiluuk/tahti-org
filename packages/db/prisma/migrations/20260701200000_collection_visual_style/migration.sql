-- Collection mood/color editor — same shape as Release (paletteJson extracted from the
-- first track's cover art, colorSchemeJson is the artist's override, visualPreset picks
-- the background visualizer).
ALTER TABLE "media"."Collection" ADD COLUMN "paletteJson" TEXT;
ALTER TABLE "media"."Collection" ADD COLUMN "colorSchemeJson" TEXT;
ALTER TABLE "media"."Collection" ADD COLUMN "visualPreset" "channel"."VisualPreset" NOT NULL DEFAULT 'MINIMAL';
