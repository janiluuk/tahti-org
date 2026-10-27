-- Proposers and voters are told when the board moves a feature request.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'FEATURE_REQUEST_UPDATED';
