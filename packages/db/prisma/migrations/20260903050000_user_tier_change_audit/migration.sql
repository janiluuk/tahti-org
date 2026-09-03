-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Record every FREE / ARTIST / STUDIO account-tier mutation in the audit log.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'USER_TIER_CHANGE';
