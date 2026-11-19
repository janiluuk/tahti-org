-- Preferred UI language for API-authored notification bodies (en | fi; null = auto).
ALTER TABLE "core"."User" ADD COLUMN "uiLocale" TEXT;
