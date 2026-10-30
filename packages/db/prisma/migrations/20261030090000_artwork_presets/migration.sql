-- CreateTable
CREATE TABLE "core"."ArtworkPreset" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtworkPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArtworkPreset_enabled_position_idx" ON "core"."ArtworkPreset"("enabled", "position");

-- The sixteen built-in covers the web app ships in public/artwork-presets.
INSERT INTO "core"."ArtworkPreset" ("id", "url", "enabled", "position", "updatedAt") VALUES
  ('artwork-preset-01', '/artwork-presets/artwork-01.webp', true, 0, CURRENT_TIMESTAMP),
  ('artwork-preset-02', '/artwork-presets/artwork-02.webp', true, 1, CURRENT_TIMESTAMP),
  ('artwork-preset-03', '/artwork-presets/artwork-03.webp', true, 2, CURRENT_TIMESTAMP),
  ('artwork-preset-04', '/artwork-presets/artwork-04.webp', true, 3, CURRENT_TIMESTAMP),
  ('artwork-preset-05', '/artwork-presets/artwork-05.webp', true, 4, CURRENT_TIMESTAMP),
  ('artwork-preset-06', '/artwork-presets/artwork-06.webp', true, 5, CURRENT_TIMESTAMP),
  ('artwork-preset-07', '/artwork-presets/artwork-07.webp', true, 6, CURRENT_TIMESTAMP),
  ('artwork-preset-08', '/artwork-presets/artwork-08.webp', true, 7, CURRENT_TIMESTAMP),
  ('artwork-preset-09', '/artwork-presets/artwork-09.webp', true, 8, CURRENT_TIMESTAMP),
  ('artwork-preset-10', '/artwork-presets/artwork-10.webp', true, 9, CURRENT_TIMESTAMP),
  ('artwork-preset-11', '/artwork-presets/artwork-11.webp', true, 10, CURRENT_TIMESTAMP),
  ('artwork-preset-12', '/artwork-presets/artwork-12.webp', true, 11, CURRENT_TIMESTAMP),
  ('artwork-preset-13', '/artwork-presets/artwork-13.webp', true, 12, CURRENT_TIMESTAMP),
  ('artwork-preset-14', '/artwork-presets/artwork-14.webp', true, 13, CURRENT_TIMESTAMP),
  ('artwork-preset-15', '/artwork-presets/artwork-15.webp', true, 14, CURRENT_TIMESTAMP),
  ('artwork-preset-16', '/artwork-presets/artwork-16.webp', true, 15, CURRENT_TIMESTAMP);
