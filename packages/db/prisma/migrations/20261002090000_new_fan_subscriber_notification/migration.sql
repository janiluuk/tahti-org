-- Artists are told when someone starts a fan subscription to them.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'NEW_FAN_SUBSCRIBER';
