-- Sprint 9: Upload flow + Collections — new style/visibility/coverMode fields

CREATE TYPE "media"."CollectionStyle" AS ENUM (
  'ALBUM', 'EP', 'SINGLE', 'DJ_SET_SERIES', 'LIVE_ARCHIVE', 'COMPILATION', 'PLAYLIST'
);

CREATE TYPE "media"."CollectionVisibility" AS ENUM (
  'PUBLIC', 'UNLISTED', 'DRAFT'
);

CREATE TYPE "media"."CollectionCoverMode" AS ENUM (
  'AUTO', 'CUSTOM'
);

ALTER TABLE "media"."Collection"
  ADD COLUMN "style"              "media"."CollectionStyle"      NOT NULL DEFAULT 'PLAYLIST',
  ADD COLUMN "visibility"         "media"."CollectionVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "coverMode"          "media"."CollectionCoverMode"  NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "publicProfileOrder" INTEGER                        NOT NULL DEFAULT 0,
  ADD COLUMN "scheduledPublishAt" TIMESTAMP(3),
  ADD COLUMN "smartLinksJson"     JSONB;

CREATE INDEX "Collection_userId_publicProfileOrder_idx"
  ON "media"."Collection"("userId", "publicProfileOrder");
