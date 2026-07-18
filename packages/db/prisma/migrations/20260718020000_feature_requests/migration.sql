-- Member feature-request board: propose, vote, discuss, quarterly board review.

ALTER TYPE "governance"."AuditAction" ADD VALUE 'FEATURE_REQUEST_CREATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE 'FEATURE_REQUEST_VOTE';
ALTER TYPE "governance"."AuditAction" ADD VALUE 'FEATURE_REQUEST_UNVOTE';
ALTER TYPE "governance"."AuditAction" ADD VALUE 'FEATURE_REQUEST_COMMENT_CREATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE 'FEATURE_REQUEST_STATUS_UPDATE';
ALTER TYPE "governance"."AuditAction" ADD VALUE 'FEATURE_REQUEST_QUARTERLY_REPORT';

CREATE TYPE "governance"."FeatureRequestStatus" AS ENUM ('OPEN', 'PLANNED', 'IN_PROGRESS', 'DONE', 'DECLINED', 'DUPLICATE');

CREATE TABLE "governance"."FeatureRequest" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "proposedById" TEXT NOT NULL,
  "status" "governance"."FeatureRequestStatus" NOT NULL DEFAULT 'OPEN',
  "mergedIntoId" TEXT,
  "reviewNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "votedInYear" INTEGER,
  "votedInQuarter" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FeatureRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeatureRequest_status_createdAt_idx" ON "governance"."FeatureRequest"("status", "createdAt");

ALTER TABLE "governance"."FeatureRequest"
  ADD CONSTRAINT "FeatureRequest_proposedById_fkey"
  FOREIGN KEY ("proposedById") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "governance"."FeatureRequest"
  ADD CONSTRAINT "FeatureRequest_mergedIntoId_fkey"
  FOREIGN KEY ("mergedIntoId") REFERENCES "governance"."FeatureRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "governance"."FeatureRequest"
  ADD CONSTRAINT "FeatureRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "governance"."FeatureRequestVote" (
  "featureRequestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FeatureRequestVote_pkey" PRIMARY KEY ("featureRequestId", "userId")
);

CREATE INDEX "FeatureRequestVote_featureRequestId_idx" ON "governance"."FeatureRequestVote"("featureRequestId");

ALTER TABLE "governance"."FeatureRequestVote"
  ADD CONSTRAINT "FeatureRequestVote_featureRequestId_fkey"
  FOREIGN KEY ("featureRequestId") REFERENCES "governance"."FeatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "governance"."FeatureRequestVote"
  ADD CONSTRAINT "FeatureRequestVote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "governance"."FeatureRequestComment" (
  "id" BIGSERIAL NOT NULL,
  "featureRequestId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FeatureRequestComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeatureRequestComment_featureRequestId_createdAt_idx" ON "governance"."FeatureRequestComment"("featureRequestId", "createdAt" ASC);

ALTER TABLE "governance"."FeatureRequestComment"
  ADD CONSTRAINT "FeatureRequestComment_featureRequestId_fkey"
  FOREIGN KEY ("featureRequestId") REFERENCES "governance"."FeatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "governance"."FeatureRequestComment"
  ADD CONSTRAINT "FeatureRequestComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "core"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "admin"."FeatureRequestQuarterlyReport" (
  "id" BIGSERIAL NOT NULL,
  "year" INTEGER NOT NULL,
  "quarter" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generatedById" TEXT NOT NULL,

  CONSTRAINT "FeatureRequestQuarterlyReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureRequestQuarterlyReport_year_quarter_key" ON "admin"."FeatureRequestQuarterlyReport"("year", "quarter");

ALTER TABLE "admin"."FeatureRequestQuarterlyReport"
  ADD CONSTRAINT "FeatureRequestQuarterlyReport_generatedById_fkey"
  FOREIGN KEY ("generatedById") REFERENCES "core"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
