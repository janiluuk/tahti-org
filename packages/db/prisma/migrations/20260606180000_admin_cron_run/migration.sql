-- M21-A: admin schema for worker cron execution logs

CREATE SCHEMA IF NOT EXISTS "admin";

CREATE TYPE "admin"."CronOutcome" AS ENUM ('SUCCESS', 'ERROR');

CREATE TABLE "admin"."CronRun" (
    "id" BIGSERIAL NOT NULL,
    "jobName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "outcome" "admin"."CronOutcome",
    "errorMessage" TEXT,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CronRun_jobName_startedAt_idx" ON "admin"."CronRun"("jobName", "startedAt" DESC);
