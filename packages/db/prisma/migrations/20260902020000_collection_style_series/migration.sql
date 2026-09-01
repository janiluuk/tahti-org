-- SERIES: a collection of a recurring show's episodes (parallel to
-- DJ_SET_SERIES, which groups DJ_SET tracks) — a one-off broadcast doesn't
-- need a collection at all, it's just tagged ArchiveContentType.SHOW.
ALTER TYPE "media"."CollectionStyle" ADD VALUE 'SERIES';
