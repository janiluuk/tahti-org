-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Outside news feeds and event directories: remember where an imported row came
-- from so a re-run updates nothing twice.

ALTER TABLE "admin"."NewsPost" ADD COLUMN "sourceKey" TEXT;
ALTER TABLE "admin"."NewsPost" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "NewsPost_sourceKey_externalId_key" ON "admin"."NewsPost"("sourceKey", "externalId");

ALTER TABLE "core"."ArtistEvent" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "core"."ArtistEvent" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "ArtistEvent_externalSource_externalId_key" ON "core"."ArtistEvent"("externalSource", "externalId");
