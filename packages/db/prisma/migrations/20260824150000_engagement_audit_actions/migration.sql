-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Audit trail coverage for likes, follows, and new fan subscriptions —
-- powers the admin activity feed.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ARCHIVE_ITEM_LIKE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ARTIST_FOLLOW';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'FAN_SUBSCRIPTION_CREATE';
