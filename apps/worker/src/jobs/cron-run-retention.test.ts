// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@tahti/db'
import {
  CRON_RUN_KEEP_PER_JOB,
  DEFAULT_CRON_RUN_RETENTION_DAYS,
  cronRunRetentionDays,
  processCronRunRetentionJob,
  pruneJobCronRuns,
} from './cron-run-retention.js'

const PREFIX = `cron-run-retention-test-${Date.now()}-`
const NOW = new Date('2026-11-22T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

async function seedRuns(jobName: string, startedAts: Date[]) {
  await prisma.cronRun.createMany({
    data: startedAts.map((startedAt) => ({
      jobName,
      startedAt,
      finishedAt: startedAt,
      outcome: 'SUCCESS' as const,
    })),
  })
}

function daysAgo(days: number, extraHours = 0): Date {
  return new Date(NOW.getTime() - days * DAY_MS - extraHours * HOUR_MS)
}

async function remaining(jobName: string): Promise<Date[]> {
  const rows = await prisma.cronRun.findMany({
    where: { jobName },
    orderBy: { startedAt: 'desc' },
    select: { startedAt: true },
  })
  return rows.map((row) => row.startedAt)
}

afterAll(async () => {
  await prisma.cronRun.deleteMany({ where: { jobName: { startsWith: PREFIX } } })
  await prisma.$disconnect()
})

describe('cronRunRetentionDays', () => {
  it('defaults to 30 days when unset or invalid', () => {
    expect(DEFAULT_CRON_RUN_RETENTION_DAYS).toBe(30)
    expect(cronRunRetentionDays({})).toBe(30)
    for (const value of ['', '0', '-5', '1.5', 'abc']) {
      expect(cronRunRetentionDays({ CRON_RUN_RETENTION_DAYS: value })).toBe(30)
    }
  })

  it('reads a positive whole number of days from CRON_RUN_RETENTION_DAYS', () => {
    expect(cronRunRetentionDays({ CRON_RUN_RETENTION_DAYS: '7' })).toBe(7)
  })
})

describe('processCronRunRetentionJob', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  it('deletes runs past the retention window and keeps recent ones', async () => {
    const job = `${PREFIX}minutely`
    const recent = Array.from({ length: 30 }, (_, i) => daysAgo(0, i))
    const old = Array.from({ length: 12 }, (_, i) => daysAgo(31, i))
    await seedRuns(job, [...recent, ...old])

    const summary = await processCronRunRetentionJob(prisma, {
      now: NOW,
      retentionDays: 30,
      keepPerJob: 5,
    })

    expect(summary.deleted).toBeGreaterThanOrEqual(12)
    expect(summary).toMatchObject({ retentionDays: 30, keepPerJob: 5 })
    expect(await remaining(job)).toEqual(recent)
  })

  it('keeps the newest runs of a job even when all of them are old', async () => {
    const monthly = `${PREFIX}monthly`
    const annual = `${PREFIX}annual`
    const monthlyRuns = Array.from({ length: CRON_RUN_KEEP_PER_JOB + 5 }, (_, i) =>
      daysAgo(40 + i * 30),
    )
    const annualRuns = [daysAgo(100), daysAgo(465)]
    await seedRuns(monthly, monthlyRuns)
    await seedRuns(annual, annualRuns)

    await processCronRunRetentionJob(prisma, { now: NOW, retentionDays: 30 })

    expect(await remaining(monthly)).toEqual(monthlyRuns.slice(0, CRON_RUN_KEEP_PER_JOB))
    expect(await remaining(annual)).toEqual(annualRuns)
  })

  it('uses the retention window as the cutoff once a job has enough newer runs', async () => {
    const job = `${PREFIX}window-edge`
    await seedRuns(job, [daysAgo(29), daysAgo(31)])

    await processCronRunRetentionJob(prisma, { now: NOW, retentionDays: 30, keepPerJob: 1 })

    expect(await remaining(job)).toEqual([daysAgo(29)])
  })
})

describe('pruneJobCronRuns', () => {
  it('deletes in batches until a batch comes back short', async () => {
    const job = `${PREFIX}batched`
    const kept = Array.from({ length: 2 }, (_, i) => daysAgo(0, i))
    const old = Array.from({ length: 10 }, (_, i) => daysAgo(60, i))
    await seedRuns(job, [...kept, ...old])

    const result = await pruneJobCronRuns(prisma, job, daysAgo(30), 2, 3)

    expect(result).toEqual({ deleted: 10, batches: 4 })
    expect(await remaining(job)).toEqual(kept)
  })

  it('does nothing for a job with no more than keepPerJob runs', async () => {
    const job = `${PREFIX}sparse`
    await seedRuns(job, [daysAgo(200), daysAgo(300)])

    const result = await pruneJobCronRuns(prisma, job, daysAgo(30), 2, 3)

    expect(result.deleted).toBe(0)
    expect(await remaining(job)).toHaveLength(2)
  })
})
