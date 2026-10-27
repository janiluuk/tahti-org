-- The board changed a setting on your account or channel (channel kind, storage, tier, membership).
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'BOARD_ACCOUNT_CHANGE';
