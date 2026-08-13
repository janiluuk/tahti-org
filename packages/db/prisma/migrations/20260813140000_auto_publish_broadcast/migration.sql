-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Persistent per-channel default for a new broadcast's autoArchive value.
ALTER TABLE "channel"."Channel" ADD COLUMN "autoPublishBroadcast" BOOLEAN NOT NULL DEFAULT true;
