-- Collection cover privacy fix: covers were served via a blanket MinIO
-- anonymous-read grant on tahti/collections, but uploads aren't gated by
-- isPublic — a private ("Vault") collection's cover was fetchable by anyone
-- with the exact URL. New uploads store the object key here and get
-- presigned URLs at read time instead; existing coverUrl rows are resolved
-- to a key on the fly at read time (see resolveCollectionCoverUrl), no
-- backfill needed.

ALTER TABLE "media"."Collection" ADD COLUMN "coverKey" TEXT;
