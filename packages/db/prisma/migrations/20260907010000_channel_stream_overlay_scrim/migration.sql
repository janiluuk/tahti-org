-- Off by default, matching streamOverlayShowTitle's precedent: an artist
-- opts into a semi-transparent dark rectangle drawn behind the baked
-- title/subtitle text on the multistream video overlay, for readability
-- over busy cover art.
ALTER TABLE "channel"."Channel" ADD COLUMN "streamOverlayScrimEnabled" BOOLEAN NOT NULL DEFAULT false;
