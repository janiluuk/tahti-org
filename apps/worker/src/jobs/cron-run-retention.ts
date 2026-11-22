// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export const DEFAULT_CRON_RUN_RETENTION_DAYS = 30
/** Rarely-running jobs (monthly, annual) keep their history, and the admin
 * "latest run per job" view never goes empty. */
export const CRON_RUN_KEEP_PER_JOB = 20
export const CRON_RUN_DELETE_BATCH = 5000

const DAY_MS = 24 * 60 * 60 * 1000

export interface CronRunRetentionOptions {
  now?: Date
  retentionDays?: number
  keepPerJob?: number
  batchSize?: number
}

export interface CronRunRetentionSummary {
  deleted: number
  batches: number
  jobNames: number
  retentionDays: number
  keepPerJob: number
}

type Db = Pick<PrismaClient, '$queryRaw' | '$executeRaw'>

export function cronRunRetentionDays(env: NodeJS.ProcessEnv = process.env): number {
  const days = Number(env.CRON_RUN_RETENTION_DAYS)
  return Number.isInteger(days) && days > 0 ? days : DEFAULT_CRON_RUN_RETENTION_DAYS
}

/** Every distinct jobName in CronRun, including names no longer in the manifest. */
async function cronRunJobNames(prisma: Db): Promise<string[]> {
  // Postgres has no skip scan here, so DISTINCT would read the whole index;
  // this recursive walk does one index lookup per job name instead.
  const rows = await prisma.$queryRaw<{ jobName: string }[]>`
    WITH RECURSIVE names AS (
      (SELECT "jobName" FROM "admin"."CronRun" ORDER BY "jobName" LIMIT 1)
      UNION ALL
      SELECT (
        SELECT c."jobName" FROM "admin"."CronRun" c
        WHERE c."jobName" > names."jobName"
        ORDER BY c."jobName" LIMIT 1
      )
      FROM names WHERE names."jobName" IS NOT NULL
    )
    SELECT "jobName" FROM names WHERE "jobName" IS NOT NULL`
  return rows.map((row) => row.jobName)
}

/** Deletes one job's runs that started before `cutoff`, except its newest
 * `keepPerJob`, at most `batchSize` rows per statement. */
export async function pruneJobCronRuns(
  prisma: Db,
  jobName: string,
  cutoff: Date,
  keepPerJob: number,
  batchSize: number,
): Promise<{ deleted: number; batches: number }> {
  const kept = await prisma.$queryRaw<{ startedAt: Date }[]>`
    SELECT "startedAt" FROM "admin"."CronRun"
    WHERE "jobName" = ${jobName}
    ORDER BY "startedAt" DESC
    OFFSET ${keepPerJob - 1} LIMIT 1`
  if (kept.length === 0) return { deleted: 0, batches: 0 }
  const before = kept[0]!.startedAt < cutoff ? kept[0]!.startedAt : cutoff

  let deleted = 0
  let batches = 0
  for (;;) {
    // Separate short statements so a first run over a large backlog never
    // holds row locks or a long transaction on the table. ANY(ARRAY(...))
    // makes Postgres delete by primary key; `IN (subquery)` plans a hash
    // join that seq-scans the whole table on every batch.
    const count = await prisma.$executeRaw`
      DELETE FROM "admin"."CronRun" WHERE "id" = ANY(ARRAY(
        SELECT "id" FROM "admin"."CronRun"
        WHERE "jobName" = ${jobName} AND "startedAt" < ${before}
        ORDER BY "startedAt"
        LIMIT ${batchSize}
      ))`
    batches++
    deleted += count
    if (count < batchSize) break
  }
  return { deleted, batches }
}

/** Prunes CronRun history older than the retention window, keeping the newest
 * runs of every job regardless of age. */
export async function processCronRunRetentionJob(
  prisma: Db,
  opts: CronRunRetentionOptions = {},
): Promise<CronRunRetentionSummary> {
  const now = opts.now ?? new Date()
  const retentionDays = opts.retentionDays ?? cronRunRetentionDays()
  const keepPerJob = opts.keepPerJob ?? CRON_RUN_KEEP_PER_JOB
  const batchSize = opts.batchSize ?? CRON_RUN_DELETE_BATCH
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS)

  const jobNames = await cronRunJobNames(prisma)
  let deleted = 0
  let batches = 0
  for (const jobName of jobNames) {
    const result = await pruneJobCronRuns(prisma, jobName, cutoff, keepPerJob, batchSize)
    deleted += result.deleted
    batches += result.batches
  }

  console.log(
    `[cron-run-retention] deleted ${deleted} CronRun rows in ${batches} batches ` +
      `(${jobNames.length} job names, older than ${retentionDays}d, newest ${keepPerJob} per job kept)`,
  )
  return { deleted, batches, jobNames: jobNames.length, retentionDays, keepPerJob }
}
