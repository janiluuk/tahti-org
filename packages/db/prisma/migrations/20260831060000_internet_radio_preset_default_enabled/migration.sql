-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Board-set "enabled by default for everyone" flag on the shared internet
-- radio preset catalog, distinct from a listener's own InternetRadioStation
-- library copy. Defaults to false so no existing preset starts appearing
-- unannounced in the Listen page radio feed.
ALTER TABLE "core"."InternetRadioPreset" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT false;
