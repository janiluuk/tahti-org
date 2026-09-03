-- Optional public liked-tracks playlist and feed activity.
ALTER TABLE "core"."User"
  ADD COLUMN "showLikes" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "ArchiveItemLike_userId_createdAt_idx"
  ON "engagement"."ArchiveItemLike" ("userId", "createdAt");
