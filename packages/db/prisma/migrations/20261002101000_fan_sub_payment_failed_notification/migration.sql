-- Fans are told when a renewal payment for their fan subscription fails.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'FAN_SUB_PAYMENT_FAILED';
