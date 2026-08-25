-- SPDX-License-Identifier: AGPL-3.0-or-later
-- New value must land in its own migration/transaction, same as
-- 20260824150000_engagement_audit_actions — Postgres won't let a value
-- be used in the same transaction that adds it.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'MISSED_LIVE_SHOW_FLAGGED';
