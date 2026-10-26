-- Coarse device labels on listen sessions for Studio audience stats.
ALTER TABLE "engagement"."ListenSession" ADD COLUMN "uaBrowser" TEXT,
ADD COLUMN "uaOs" TEXT,
ADD COLUMN "uaDeviceType" TEXT,
ADD COLUMN "uaDeviceVendor" TEXT,
ADD COLUMN "isBot" BOOLEAN NOT NULL DEFAULT false;
