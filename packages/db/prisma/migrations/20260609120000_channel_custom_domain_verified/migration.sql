-- PLAT-051: add customDomainVerified flag to Channel
ALTER TABLE "channel"."Channel" ADD COLUMN "customDomainVerified" BOOLEAN NOT NULL DEFAULT false;
