-- A member mentioned you in a discussion reply.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'DISCUSSION_MENTION';
ALTER TYPE "core"."MentionSurface" ADD VALUE IF NOT EXISTS 'DISCUSSION';
