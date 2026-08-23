// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { prisma } from '@tahti/db'
import { WORKER_CRON_JOBS } from '@tahti/shared'

const CRON_JOB_NAMES = new Set(WORKER_CRON_JOBS.map((j) => j.name))

/** Wrap repeatable cron handlers with CronRun persistence for the admin
 * dashboard. Returns whatever `fn` returns, so a non-cron job's result (e.g.
 * one a caller awaits via BullMQ's `waitUntilFinished`) still reaches the
 * queue's `job.returnvalue`. */
export async function runWithCronLog<T>(jobName: string, fn: () => Promise<T>): Promise<T> {
  if (!CRON_JOB_NAMES.has(jobName)) {
    return fn()
  }

  const run = await prisma.cronRun.create({
    data: { jobName, startedAt: new Date() },
  })

  try {
    const result = await fn()
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), outcome: 'SUCCESS' },
    })
    return result
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
