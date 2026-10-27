-- Your Tahti ry membership year ended and the account went back to Free.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_ENDED';
