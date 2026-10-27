-- When the author last edited a discussion reply.
ALTER TABLE "governance"."DiscussionPost" ADD COLUMN "editedAt" TIMESTAMP(3);
