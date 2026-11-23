-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Notify artists when the pattern-fraud scan flags their channel.

ALTER TYPE "core"."NotificationType" ADD VALUE 'PATTERN_FRAUD_FLAGGED';
