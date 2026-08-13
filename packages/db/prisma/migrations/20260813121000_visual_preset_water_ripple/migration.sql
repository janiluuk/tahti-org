-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Pre-existing gap: packages/shared's VISUAL_PRESETS (and 5 web components) have
-- shipped "WATER_RIPPLE" as a selectable preset since M31, but the DB enum never
-- got it — every Channel/ArchiveItem/Release update that picks it fails at the
-- Prisma layer. Found while wiring up @tahti/api-client's typecheck.
ALTER TYPE "channel"."VisualPreset" ADD VALUE IF NOT EXISTS 'WATER_RIPPLE';
