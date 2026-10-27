-- The board's annual grant run awarded you a grant.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'GRANT_AWARDED';
