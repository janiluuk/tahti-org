-- The board accepted or turned down a radio station you suggested.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'RADIO_STATION_REVIEWED';
