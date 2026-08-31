-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Audit trail coverage for radio slot booking create/update/cancel and channel go-live.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'RADIO_SLOT_BOOKING_CREATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'RADIO_SLOT_BOOKING_UPDATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'RADIO_SLOT_BOOKING_CANCEL';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'CHANNEL_GO_LIVE';
