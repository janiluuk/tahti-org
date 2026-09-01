-- RADIO_SHOW -> SHOW: a single one-off broadcast is just "SHOW" (still
-- displayed as "Radio show"); a recurring show's episodes get their own
-- ArchiveContentType (EPISODE) and their own CollectionStyle (SERIES,
-- see the media-schema migration below) instead of overloading RADIO_SHOW
-- for both.
--
-- EPISODE: one episode of a running series — a podcast's or a recurring
-- show's — as opposed to a one-off SHOW or PODCAST upload.
-- CLIP: short-form audio — clips, previews, and other small-scale material
-- (the frontend already had a phantom "AUDIOCLIPS" option with no backing
-- enum value; CLIP is the real one it now maps to).
-- EMBED: a track that only exists via another provider's embed widget
-- (embedProvider/embedUri set, no audio hosted here), as opposed to an
-- uploaded file.
--
-- RENAME VALUE is metadata-only; ADD VALUE is additive with no data to
-- migrate — both verified safe in the same transaction against a
-- disposable Postgres (existing RADIO_SHOW rows carry over as SHOW, no
-- rewrite, no lock beyond the instant the transaction commits).
BEGIN;
ALTER TYPE "channel"."ArchiveContentType" RENAME VALUE 'RADIO_SHOW' TO 'SHOW';
ALTER TYPE "channel"."ArchiveContentType" ADD VALUE 'EPISODE';
ALTER TYPE "channel"."ArchiveContentType" ADD VALUE 'CLIP';
ALTER TYPE "channel"."ArchiveContentType" ADD VALUE 'EMBED';
COMMIT;
