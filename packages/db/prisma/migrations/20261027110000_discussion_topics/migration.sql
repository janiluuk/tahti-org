-- Board-started discussion topics with member replies and per-topic mute.
CREATE TYPE "governance"."DiscussionTopicStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "governance"."DiscussionTopic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "governance"."DiscussionTopicStatus" NOT NULL DEFAULT 'OPEN',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "lastPostAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscussionTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "governance"."DiscussionPost" (
    "id" BIGSERIAL NOT NULL,
    "topicId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "governance"."DiscussionParticipant" (
    "topicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mutedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionParticipant_pkey" PRIMARY KEY ("topicId","userId")
);

CREATE INDEX "DiscussionTopic_status_pinned_lastPostAt_idx" ON "governance"."DiscussionTopic"("status", "pinned", "lastPostAt");
CREATE INDEX "DiscussionPost_topicId_createdAt_idx" ON "governance"."DiscussionPost"("topicId", "createdAt" ASC);
CREATE INDEX "DiscussionParticipant_userId_idx" ON "governance"."DiscussionParticipant"("userId");

ALTER TABLE "governance"."DiscussionTopic" ADD CONSTRAINT "DiscussionTopic_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "governance"."DiscussionPost" ADD CONSTRAINT "DiscussionPost_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "governance"."DiscussionTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "governance"."DiscussionPost" ADD CONSTRAINT "DiscussionPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "governance"."DiscussionParticipant" ADD CONSTRAINT "DiscussionParticipant_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "governance"."DiscussionTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "governance"."DiscussionParticipant" ADD CONSTRAINT "DiscussionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
