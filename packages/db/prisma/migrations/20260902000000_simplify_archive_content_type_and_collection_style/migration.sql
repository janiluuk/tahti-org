-- ArchiveContentType: DJ_MIX -> DJ_SET (rename — clearer than "mix"), and
-- ORIGINAL removed (an "original" upload is just a track — merged into
-- TRACK). Rename first (metadata-only, no data touched), then reclassify
-- ORIGINAL rows before the type swap so the enum-cast below never sees a
-- label that's about to stop existing.
ALTER TYPE "channel"."ArchiveContentType" RENAME VALUE 'DJ_MIX' TO 'DJ_SET';

UPDATE "channel"."ArchiveItem" SET "contentType" = 'TRACK' WHERE "contentType" = 'ORIGINAL';

BEGIN;
CREATE TYPE "channel"."ArchiveContentType_new" AS ENUM ('LIVE', 'TRACK', 'DJ_SET', 'PODCAST', 'REMIX', 'RADIO_SHOW');
ALTER TABLE "channel"."ArchiveItem" ALTER COLUMN "contentType" DROP DEFAULT;
ALTER TABLE "channel"."ArchiveItem" ALTER COLUMN "contentType" TYPE "channel"."ArchiveContentType_new" USING ("contentType"::text::"channel"."ArchiveContentType_new");
ALTER TYPE "channel"."ArchiveContentType" RENAME TO "ArchiveContentType_old";
ALTER TYPE "channel"."ArchiveContentType_new" RENAME TO "ArchiveContentType";
DROP TYPE "channel"."ArchiveContentType_old";
ALTER TABLE "channel"."ArchiveItem" ALTER COLUMN "contentType" SET DEFAULT 'TRACK';
COMMIT;

-- CollectionStyle: LIVE_ARCHIVE -> RECORDING (rename; stays a valid stored
-- value but not offered as a selectable style in the create/edit forms),
-- and COMPILATION removed (merged into PLAYLIST). Same rename-then-reclassify
-- ordering as above.
ALTER TYPE "media"."CollectionStyle" RENAME VALUE 'LIVE_ARCHIVE' TO 'RECORDING';

UPDATE "media"."Collection" SET "style" = 'PLAYLIST' WHERE "style" = 'COMPILATION';

BEGIN;
CREATE TYPE "media"."CollectionStyle_new" AS ENUM ('ALBUM', 'EP', 'SINGLE', 'DJ_SET_SERIES', 'PODCAST', 'RECORDING', 'PLAYLIST');
ALTER TABLE "media"."Collection" ALTER COLUMN "style" DROP DEFAULT;
ALTER TABLE "media"."Collection" ALTER COLUMN "style" TYPE "media"."CollectionStyle_new" USING ("style"::text::"media"."CollectionStyle_new");
ALTER TYPE "media"."CollectionStyle" RENAME TO "CollectionStyle_old";
ALTER TYPE "media"."CollectionStyle_new" RENAME TO "CollectionStyle";
DROP TYPE "media"."CollectionStyle_old";
ALTER TABLE "media"."Collection" ALTER COLUMN "style" SET DEFAULT 'PLAYLIST';
COMMIT;
