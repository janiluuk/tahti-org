-- The board took your channel out of Tahti Radio, or put it back.
ALTER TYPE "core"."NotificationType" ADD VALUE IF NOT EXISTS 'TAHTI_RADIO_INCLUSION_CHANGED';
