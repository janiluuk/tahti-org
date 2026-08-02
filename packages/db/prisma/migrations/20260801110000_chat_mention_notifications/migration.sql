-- Chat @mentions: surface for channel chat + in-app notification type
ALTER TYPE "core"."MentionSurface" ADD VALUE IF NOT EXISTS 'CHAT';
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'CHAT_MENTION';
