-- Ordered event image gallery: [{ "url": "...", "caption": "..." }].
ALTER TABLE "core"."ArtistEvent" ADD COLUMN "gallery" JSONB NOT NULL DEFAULT '[]';
