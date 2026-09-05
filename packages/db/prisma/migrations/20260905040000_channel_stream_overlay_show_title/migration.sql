-- Off by default: an artist opts into baking title/subtitle text onto the
-- multistream video overlay, instead of it always showing (falling back to
-- display name) whether they set it up or not.
ALTER TABLE "channel"."Channel" ADD COLUMN "streamOverlayShowTitle" BOOLEAN NOT NULL DEFAULT false;
