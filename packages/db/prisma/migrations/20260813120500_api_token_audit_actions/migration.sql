-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Audit trail coverage for personal API token create/revoke.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'API_TOKEN_CREATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'API_TOKEN_REVOKE';
