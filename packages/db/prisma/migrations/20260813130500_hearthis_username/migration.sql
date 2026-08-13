-- SPDX-License-Identifier: AGPL-3.0-or-later
-- "Your tracks" tab for hearthis.at mixed-source collections, mirroring mixcloudUsername.
ALTER TABLE "core"."User" ADD COLUMN "hearthisUsername" TEXT;
