-- The board can correct an approved annual report; replaced versions are kept.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'ANNUAL_REPORT_CORRECT';

ALTER TABLE "admin"."AnnualReport" ADD COLUMN "correctedAt" TIMESTAMP(3);

CREATE TABLE "admin"."AnnualReportRevision" (
    "id" BIGSERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedById" TEXT,
    "note" TEXT NOT NULL,

    CONSTRAINT "AnnualReportRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnnualReportRevision_year_replacedAt_idx" ON "admin"."AnnualReportRevision"("year", "replacedAt");
