-- A venue show you are part of was cancelled by the artist or the venue.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'VENUE_SHOW_CANCELED';
