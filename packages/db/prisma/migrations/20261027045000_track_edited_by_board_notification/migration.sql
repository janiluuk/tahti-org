-- A board member edited the details of one of your tracks.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'TRACK_EDITED_BY_BOARD';
