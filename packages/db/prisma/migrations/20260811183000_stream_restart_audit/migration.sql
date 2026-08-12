-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Board stream-manager: audit Liquidsoap restarts from /admin/streams
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'STREAM_RESTART';
