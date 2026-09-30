-- CreateEnum
CREATE TYPE "core"."RadioStationSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "core"."RadioStationSuggestion" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "language" TEXT NOT NULL,
    "bitrateKbps" INTEGER,
    "streamUrl" TEXT NOT NULL,
    "status" "core"."RadioStationSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "presetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadioStationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RadioStationSuggestion_status_createdAt_idx" ON "core"."RadioStationSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RadioStationSuggestion_submitterId_idx" ON "core"."RadioStationSuggestion"("submitterId");

-- AddForeignKey
ALTER TABLE "core"."RadioStationSuggestion" ADD CONSTRAINT "RadioStationSuggestion_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."RadioStationSuggestion" ADD CONSTRAINT "RadioStationSuggestion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

