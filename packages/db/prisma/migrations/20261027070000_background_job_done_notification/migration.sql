-- Something you started in the background finished (a render, an export, an import, a delivery).
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'BACKGROUND_JOB_DONE';
