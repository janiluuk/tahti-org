-- Fans are told when one of their fan subscriptions ends.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'FAN_SUB_EXPIRED';
