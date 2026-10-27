-- An artist added a show at a venue you run.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'VENUE_SHOW_BOOKED';
