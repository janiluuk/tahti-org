-- People are told when an artist makes them a moderator of a channel.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'MODERATOR_ADDED';
