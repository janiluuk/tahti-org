-- When a follower last opened a topic, for its unread reply count.
ALTER TABLE "governance"."DiscussionParticipant" ADD COLUMN "lastReadAt" TIMESTAMP(3);
