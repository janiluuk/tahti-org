-- M21-G: annual transparency report metadata

CREATE TABLE "admin"."AnnualReport" (
    "id" BIGSERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,

    CONSTRAINT "AnnualReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnualReport_year_key" ON "admin"."AnnualReport"("year");

ALTER TABLE "admin"."AnnualReport" ADD CONSTRAINT "AnnualReport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
