-- SPDX-License-Identifier: AGPL-3.0-or-later
-- New enum values must land in their own migration/transaction, same as
-- 20260824150000_engagement_audit_actions — Postgres won't let a value
-- be used in the same transaction that adds it.
-- Lets an artist open their green room to any signed-in listener, not just
-- moderators/fan subs — the invite list is skipped entirely for this pool.
ALTER TYPE "channel"."GreenRoomInvitePool" ADD VALUE IF NOT EXISTS 'EVERYONE';
ALTER TYPE "channel"."GreenRoomInviteSource" ADD VALUE IF NOT EXISTS 'PUBLIC';
