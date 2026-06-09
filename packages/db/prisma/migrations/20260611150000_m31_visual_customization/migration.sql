-- M31: Channel & release visual customization
-- VisualPreset and SlideshowPreset enums + new fields on Channel, ArchiveItem, Release

CREATE TYPE "channel"."VisualPreset" AS ENUM ('MINIMAL', 'WAVEFORM_BARS', 'PARTICLE_FIELD', 'AURORA', 'REACTIVE_GRID');
CREATE TYPE "channel"."SlideshowPreset" AS ENUM ('FADE', 'ZOOM', 'PAN', 'BLUR_CROSS');

ALTER TABLE "channel"."Channel"
  ADD COLUMN "colorSchemeJson"         TEXT,
  ADD COLUMN "visualPreset"            "channel"."VisualPreset" NOT NULL DEFAULT 'MINIMAL',
  ADD COLUMN "slideshowPreset"         "channel"."SlideshowPreset" NOT NULL DEFAULT 'FADE',
  ADD COLUMN "slideshowIntervalSeconds" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "slideshowTransitionMs"   INTEGER NOT NULL DEFAULT 600,
  ADD COLUMN "slideshowAutoplay"       BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "channel"."ArchiveItem"
  ADD COLUMN "visualPreset" "channel"."VisualPreset" NOT NULL DEFAULT 'MINIMAL';

ALTER TABLE "release"."Release"
  ADD COLUMN "paletteJson"     TEXT,
  ADD COLUMN "colorSchemeJson" TEXT,
  ADD COLUMN "visualPreset"    "channel"."VisualPreset" NOT NULL DEFAULT 'MINIMAL';
