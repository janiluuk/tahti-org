// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { Worker, Queue } from 'bullmq'
import { prisma } from '@tahti/db'
import { runAnnualGrantCalc } from '@tahti/ledger'
import { processTranscodeJob } from './jobs/transcode.js'
import { processTranscodeReleaseTrackJob } from './jobs/transcode-release-track.js'
import { processMixcloudUploadJob } from './jobs/mixcloud-upload.js'
import { processNewsletterDispatch } from './jobs/newsletter-dispatch.js'
import { processArchiveBroadcastJob } from './jobs/archive-broadcast.js'
import { processMonthlyLedgerRollup } from './jobs/monthly-ledger-rollup.js'
import { processBroadcastCapTick, processWeeklyBroadcastReset } from './jobs/broadcast-cap.js'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379', 10),
}

const worker = new Worker(
  'media',
  async (job) => {
    if (job.name === 'transcode-archive') {
      await processTranscodeJob(job)
    } else if (job.name === 'transcode-release-track') {
      await processTranscodeReleaseTrackJob(job)
    } else if (job.name === 'mixcloud-upload') {
      await processMixcloudUploadJob(job)
    } else if (job.name === 'newsletter-dispatch') {
      await processNewsletterDispatch(job)
    } else if (job.name === 'archive-broadcast') {
      await processArchiveBroadcastJob(job)
    } else if (job.name === 'monthly-ledger-rollup') {
      await processMonthlyLedgerRollup(job)
    } else if (job.name === 'broadcast-cap-tick') {
      const summary = await processBroadcastCapTick(prisma)
      console.log('[worker] broadcast-cap-tick:', JSON.stringify(summary))
    } else if (job.name === 'weekly-broadcast-reset') {
      const summary = await processWeeklyBroadcastReset(prisma)
      console.log('[worker] weekly-broadcast-reset:', JSON.stringify(summary))
    } else if (job.name === 'annual-grant-calc') {
      // Default to the prior calendar year (matches Finnish fiscal year).
      const { year } = job.data as { year?: number }
      const forYear = year ?? new Date().getUTCFullYear() - 1
      const summary = await runAnnualGrantCalc(prisma, forYear)
      console.log(`[worker] annual-grant-calc ${forYear}:`, JSON.stringify(summary))
    } else {
      console.log(`[worker] unknown job ${job.name}, skipping`)
    }
  },
  { connection },
)

worker.on('completed', (job) => {
  console.log(`[worker] job ${job.id} (${job.name}) completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id} (${job?.name}) failed:`, err)
})

// Register repeatable cron jobs — idempotent (BullMQ deduplicates by key)
async function registerCrons() {
  const queue = new Queue('media', { connection })

  // Monthly ledger rollup: runs at 02:00 on the 2nd of every month
  await queue.add(
    'monthly-ledger-rollup',
    {},
    { repeat: { pattern: '0 2 2 * *' }, jobId: 'monthly-ledger-rollup-cron' },
  )

  // Annual grant calculation: 03:00 on March 1 for the prior fiscal year
  await queue.add(
    'annual-grant-calc',
    {},
    { repeat: { pattern: '0 3 1 3 *' }, jobId: 'annual-grant-calc-cron' },
  )

  // M20: increment free-tier live seconds every minute; disconnect at cap
  await queue.add(
    'broadcast-cap-tick',
    {},
    { repeat: { pattern: '* * * * *' }, jobId: 'broadcast-cap-tick-cron' },
  )

  // M20: reset free-tier weekly counters Monday 00:00 UTC
  await queue.add(
    'weekly-broadcast-reset',
    {},
    { repeat: { pattern: '0 0 * * 1' }, jobId: 'weekly-broadcast-reset-cron' },
  )

  await queue.close()
  console.log('[worker] cron jobs registered')
}

registerCrons().catch((err: unknown) => {
  console.error('[worker] failed to register crons:', err)
})

process.on('SIGTERM', async () => {
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
})

console.log('[worker] started, listening for jobs on media queue')
