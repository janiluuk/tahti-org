-- Artists are told when fan-subscription money is paid out to them.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'PAYOUT_SENT';
