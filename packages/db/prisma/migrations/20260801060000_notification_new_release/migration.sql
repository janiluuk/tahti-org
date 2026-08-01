-- Announce published releases from Tahti Radio–opted-in artists to followers.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'NEW_RELEASE';
