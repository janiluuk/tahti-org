-- A fan cancelled their subscription to you (perks run to the end of the period).
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'FAN_SUB_CANCELED';
