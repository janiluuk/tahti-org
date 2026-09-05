-- Null keeps the historical hardcoded colors (white title, light-slate
-- subtitle) baked into the multistream video overlay — set once an artist
-- actually picks a color from the editor.
ALTER TABLE "channel"."Channel" ADD COLUMN "streamOverlayTextColor" TEXT;
