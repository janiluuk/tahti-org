// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { prisma } from '@tahti/db'
import { WORKER_CRON_JOBS } from '@tahti/shared'

const CRON_JOB_NAMES = new Set(WORKER_CRON_JOBS.map((j) => j.name))

/** Wrap repeatable cron handlers with CronRun persistence for the admin dashboard. */
export async function runWithCronLog(jobName: string, fn: () => Promise<void>): Promise<void> {
  if (!CRON_JOB_NAMES.has(jobName)) {
    await fn()
    return
  }

  const run = await prisma.cronRun.create({
    data: { jobName, startedAt: new Date() },
  })

  try {
    await fn()
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), outcome: 'SUCCESS' },
    })
  } catch (err) {
    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        outcome: 'ERROR',
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    })
    throw err
  }
}
