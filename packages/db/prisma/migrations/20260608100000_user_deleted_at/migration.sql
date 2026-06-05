-- M19: soft-delete marker for GDPR account erasure
ALTER TABLE "core"."User" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TYPE "governance"."AuditAction" ADD VALUE 'ACCOUNT_DELETE';
