-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Comments on public artist events (chat-alike thread on /events/:id).

ALTER TABLE "engagement"."Comment" ADD COLUMN "eventId" TEXT;

CREATE INDEX "Comment_eventId_createdAt_idx" ON "engagement"."Comment"("eventId", "createdAt");

ALTER TABLE "engagement"."Comment" ADD CONSTRAINT "Comment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "core"."ArtistEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
