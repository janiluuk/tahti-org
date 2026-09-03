-- CreateEnum
CREATE TYPE "channel"."TrackAccessMode" AS ENUM ('FREE', 'SUBSCRIBERS_ONLY', 'PURCHASE');

-- CreateEnum
CREATE TYPE "fansubs"."PurchaseState" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- AlterEnum
ALTER TYPE "ledger"."LedgerCategory" ADD VALUE 'PURCHASE_TIER_GROSS_RECEIVED';
ALTER TYPE "ledger"."LedgerCategory" ADD VALUE 'PURCHASE_TIER_NET_TO_ARTIST';
ALTER TYPE "ledger"."LedgerCategory" ADD VALUE 'PURCHASE_TIER_OPERATIONAL_FEE';

-- AlterTable
ALTER TABLE "channel"."ArchiveItem" ADD COLUMN     "accessMode" "channel"."TrackAccessMode" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "purchaseTierId" TEXT;

-- AlterTable
ALTER TABLE "channel"."Channel" ADD COLUMN     "storeEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "fansubs"."PurchaseTier" (
    "id" TEXT NOT NULL,
    "artistUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "priceOptional" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fansubs"."Purchase" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "artistUserId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "state" "fansubs"."PurchaseState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseTier_artistUserId_active_idx" ON "fansubs"."PurchaseTier"("artistUserId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_stripeCheckoutSessionId_key" ON "fansubs"."Purchase"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "Purchase_artistUserId_createdAt_idx" ON "fansubs"."Purchase"("artistUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Purchase_buyerUserId_tierId_idx" ON "fansubs"."Purchase"("buyerUserId", "tierId");

-- CreateIndex
CREATE INDEX "ArchiveItem_purchaseTierId_idx" ON "channel"."ArchiveItem"("purchaseTierId");

-- AddForeignKey
ALTER TABLE "channel"."ArchiveItem" ADD CONSTRAINT "ArchiveItem_purchaseTierId_fkey" FOREIGN KEY ("purchaseTierId") REFERENCES "fansubs"."PurchaseTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fansubs"."PurchaseTier" ADD CONSTRAINT "PurchaseTier_artistUserId_fkey" FOREIGN KEY ("artistUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fansubs"."Purchase" ADD CONSTRAINT "Purchase_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "fansubs"."PurchaseTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fansubs"."Purchase" ADD CONSTRAINT "Purchase_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
