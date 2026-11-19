-- Engagement pattern detection (batch accounts / even intervals / clusters / rings).
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'PATTERN_FRAUD_ALERT';
