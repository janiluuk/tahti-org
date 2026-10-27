-- The board approved, rejected or disabled an add-on you published.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'ADDON_REVIEWED';
