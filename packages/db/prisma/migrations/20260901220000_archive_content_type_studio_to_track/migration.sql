-- The "STUDIO" content type meant "an ordinary studio-recorded track" but
-- read as a duplicate of the unrelated ArtistTier.STUDIO subscription tier.
-- Renaming the enum label is a metadata-only op — existing ArchiveItem rows
-- (and the column default) are recognized by OID, not by label, so this
-- carries every existing "STUDIO" row over to "TRACK" with no data rewrite.
ALTER TYPE "channel"."ArchiveContentType" RENAME VALUE 'STUDIO' TO 'TRACK';
