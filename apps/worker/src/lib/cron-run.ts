// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { prisma } from '@tahti/db'
import { WORKER_CRON_JOBS } from '@tahti/shared'

const CRON_JOB_NAMES = new Set(WORKER_CRON_JOBS.map((j) => j.name))
const MAX_RESULT_LENGTH = 16_000

export function serializeCronResult(result: unknown): string {
  const serialized = JSON.stringify(result ?? null, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  )
  if (serialized.length <= MAX_RESULT_LENGTH) return serialized
  return JSON.stringify({
    truncated: true,
    originalLength: serialized.length,
    preview: serialized.slice(0, MAX_RESULT_LENGTH - 100),
  })
}

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
  const startedAtMs = Date.now()

  try {
    const result = await fn()
    const finishedAt = new Date()
    const durationMs = Date.now() - startedAtMs
    const resultJson = serializeCronResult(result)
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { finishedAt, outcome: 'SUCCESS', resultJson },
    })
    console.log(`[cron] ${jobName} success durationMs=${durationMs} result=${resultJson}`)
    return result
  } catch (err) {
    const finishedAt = new Date()
    const durationMs = Date.now() - startedAtMs
    const errorMessage = err instanceof Error ? err.message : String(err)
    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        finishedAt,
        outcome: 'ERROR',
        errorMessage,
      },
    })
    console.error(`[cron] ${jobName} error durationMs=${durationMs} error=${errorMessage}`)
    throw err
  }
}
