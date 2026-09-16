-- The original hearthis.at track page URL, kept only for HEARTHIS_EMBED so a
-- manual "Import" action can re-fetch download info later. embedUri stores
-- the bare numeric hearthis track id (used to build the embed iframe), which
-- the hearthis.at API can't look tracks up by directly.
ALTER TABLE "channel"."Sound" ADD COLUMN     "embedSourceUrl" TEXT;
