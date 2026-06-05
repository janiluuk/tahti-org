-- Phase 9: per-platform smart link click tracking (M14 analytics)

CREATE TABLE IF NOT EXISTS "release"."SmartLinkClick" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "referer" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartLinkClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SmartLinkClick_releaseId_platform_idx"
  ON "release"."SmartLinkClick"("releaseId", "platform");

CREATE INDEX IF NOT EXISTS "SmartLinkClick_releaseId_createdAt_idx"
  ON "release"."SmartLinkClick"("releaseId", "createdAt");

ALTER TABLE "release"."SmartLinkClick"
  ADD CONSTRAINT "SmartLinkClick_releaseId_fkey"
  FOREIGN KEY ("releaseId") REFERENCES "release"."Release"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
