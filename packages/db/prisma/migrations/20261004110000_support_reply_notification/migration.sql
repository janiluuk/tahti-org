-- People are told when the board replies to their support request.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_REPLY';
