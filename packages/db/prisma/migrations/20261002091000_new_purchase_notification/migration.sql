-- Artists are told when someone pays for one of their purchase tiers.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'NEW_PURCHASE';
