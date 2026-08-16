-- SPDX-License-Identifier: AGPL-3.0-or-later
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'USER_LOGIN';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'USER_REGISTER';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'CONTENT_UPLOAD';
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'RELEASE_PUBLISH';
