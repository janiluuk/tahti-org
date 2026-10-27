-- The board restricted your uploads or bookings, or lifted that.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'ACCOUNT_RESTRICTED';
