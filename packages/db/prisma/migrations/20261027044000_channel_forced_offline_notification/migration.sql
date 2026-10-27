-- The board took your live broadcast off the air.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'CHANNEL_FORCED_OFFLINE';
