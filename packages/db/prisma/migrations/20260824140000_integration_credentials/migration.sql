-- Generic per-user credential storage for the code-level integration-provider
-- registry (import/export sources, fingerprinting providers a user installs
-- with their own API key), plus hearthis.at export status tracking on
-- ArchiveItem (mirrors Release.revelatorId/revelatorStatus).

-- AlterTable
ALTER TABLE "channel"."ArchiveItem" ADD COLUMN     "hearthisExportId" TEXT,
ADD COLUMN     "hearthisExportStatus" TEXT,
ADD COLUMN     "hearthisExportedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "core"."IntegrationCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "fieldsEnc" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationCredential_userId_idx" ON "core"."IntegrationCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationCredential_userId_providerSlug_key" ON "core"."IntegrationCredential"("userId", "providerSlug");

-- AddForeignKey
ALTER TABLE "core"."IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
