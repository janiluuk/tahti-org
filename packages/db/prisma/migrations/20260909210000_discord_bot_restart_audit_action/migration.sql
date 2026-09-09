-- Audit action for the board-triggered radio-discord-bot container restart.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'DISCORD_BOT_RESTART';
