-- The association's registered identity and contacts.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ASSOCIATION_PROFILE_UPDATE';

CREATE TABLE "governance"."AssociationProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT,
    "businessId" TEXT,
    "registerNumber" TEXT,
    "domicile" TEXT,
    "contactEmail" TEXT,
    "postalAddress" TEXT,
    "website" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssociationProfile_pkey" PRIMARY KEY ("id")
);
