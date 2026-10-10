-- The result of a motion is fixed when it closes.
ALTER TABLE "governance"."Motion" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "governance"."Motion" ADD COLUMN "resultTally" JSONB;
ALTER TABLE "governance"."Motion" ADD COLUMN "resultDigest" TEXT;
