-- Opt-out for in-app notices about background Studio work (uploads, renders, exports...).
ALTER TABLE "core"."User" ADD COLUMN "notifyStudioJobsInApp" BOOLEAN NOT NULL DEFAULT true;
